import { LogColours } from '../presentation/appearance';
import { hkdfExpandLabel } from './hkdf';
import { concat, equal } from '../util/array';
import cs from '../util/cryptoProxy';
import { Cert } from './cert';
import type { RootCertsDatabase } from './cert';
import { highlightBytes } from '../presentation/highlights';
import { log } from '../presentation/log';
import { ASN1Bytes } from '../util/asn1bytes';
import { hexFromU8 } from '../util/hex';
import { ecdsaVerify } from './ecdsa';
import { verifyCerts } from './verifyCerts';

const txtEnc = new TextEncoder();

export async function readEncryptedHandshake(
  host: string,
  hs: ASN1Bytes,
  serverSecret: Uint8Array,
  hellos: Uint8Array,
  rootCertsDatabase: RootCertsDatabase,
  requireServerTlsExtKeyUsage = true,
  requireDigitalSigKeyUsage = true,
) {

  await hs.expectUint8(0x08, chatty && 'handshake record type: encrypted extensions ([RFC 8446 §4.3.1](https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.1))');
  const [eeMessageEnd] = await hs.expectLengthUint24();
  const [extEnd, extRemaining] = await hs.expectLengthUint16(chatty && 'extensions');

  while (extRemaining() > 0) {
    const extType = await hs.readUint16(chatty && 'extension type:');

    if (extType === 0x0000) {
      /*
      "A server that receives a client hello containing the "server_name"
      extension MAY use the information contained in the extension to guide
      its selection of an appropriate certificate to return to the client,
      and / or other aspects of security policy. In this event, the server
      SHALL include an extension of type "server_name" in the (extended)
      server hello. The "extension_data" field of this extension SHALL be empty.
      - https://datatracker.ietf.org/doc/html/rfc6066#section-3
      */
      chatty && hs.comment('SNI');
      await hs.expectUint16(0x0000, chatty && 'no extension data ([RFC 6066 §3](https://datatracker.ietf.org/doc/html/rfc6066#section-3))');

    } else if (extType === 0x000a) {
      /*
      As of TLS 1.3, servers are permitted to send the "supported_groups"
      extension to the client.  Clients MUST NOT act upon any information
      found in "supported_groups" prior to successful completion of the
      handshake but MAY use the information learned from a successfully
      completed handshake to change what groups they use in their
      "key_share" extension in subsequent connections.  If the server has a
      group it prefers to the ones in the "key_share" extension but is
      still willing to accept the ClientHello, it SHOULD send
      "supported_groups" to update the client's view of its preferences;
      this extension SHOULD contain all groups the server supports,
      regardless of whether they are currently supported by the client.
      - https://www.rfc-editor.org/rfc/rfc8446#section-4.2
      */
      chatty && hs.comment('supported groups ([RFC 8446 §4.2](https://www.rfc-editor.org/rfc/rfc8446#section-4.2), [§4.2.7](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7))');
      const [endGroupsData] = await hs.expectLengthUint16(chatty && 'groups data');
      const [endGroups, groupsRemaining] = await hs.expectLengthUint16(chatty && 'groups');
      chatty && hs.comment('(most preferred first)');

      while (groupsRemaining() > 0) {
        const group = await hs.readUint16();
        if (chatty) {
          const groupName = {
            0x0017: 'secp256r1',
            0x0018: 'secp384r1',
            0x0019: 'secp521r1',
            0x001D: 'x25519',
            0x001E: 'x448',
            0x0100: 'ffdhe2048',
            0x0101: 'ffdhe3072',
            0x0102: 'ffdhe4096',
            0x0103: 'ffdhe6144',
            0x0104: 'ffdhe8192',
          }[group] ?? 'unrecognised group';
          hs.comment(`group: ${groupName}`);
        }
      }
      endGroups();
      endGroupsData();

    } else {
      throw new Error(`Unsupported server encrypted extension type 0x${hexFromU8([extType]).padStart(4, '0')}`);
    }
  }
  extEnd();
  eeMessageEnd();

  let clientCertRequested = false;

  // certificate request (unusual)
  let certMsgType = await hs.readUint8();
  if (certMsgType === 0x0d) {
    chatty && hs.comment('handshake record type: certificate request ([RFC 8446 §4.3.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.2))');
    clientCertRequested = true;

    const [endCertReq] = await hs.expectLengthUint24('certificate request data');

    // this field SHALL be zero length unless used for the post-handshake authentication exchanges described in Section 4.6.2
    await hs.expectUint8(0x00, chatty && 'length of certificate request context');

    const [endCertReqExts, certReqExtsRemaining] = await hs.expectLengthUint16('certificate request extensions');
    await hs.skipRead(certReqExtsRemaining(), chatty && 'certificate request extensions (ignored)');
    endCertReqExts();

    endCertReq();

    certMsgType = await hs.readUint8();
  }

  // certificates
  if (certMsgType !== 0x0b) throw new Error(`Unexpected handshake message type 0x${hexFromU8([certMsgType])}`);
  chatty && hs.comment('handshake record type: certificate ([RFC 8446 §4.4.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.4.2))');
  const [endCertPayload] = await hs.expectLengthUint24(chatty && 'certificate payload');

  await hs.expectUint8(0x00, chatty && 'no bytes of request context follow');
  const [endCerts, certsRemaining] = await hs.expectLengthUint24(chatty && 'certificates');

  const certs: Cert[] = [];
  while (certsRemaining() > 0) {
    const [endCert] = await hs.expectLengthUint24(chatty && 'certificate');
    const cert = await Cert.create(hs);  // this parses the cert and advances the Bytes object offset
    certs.push(cert);
    endCert();

    const [endCertExt, certExtRemaining] = await hs.expectLengthUint16('certificate extensions');
    await hs.skipRead(certExtRemaining());
    endCertExt();
  }
  endCerts();
  endCertPayload();

  if (certs.length === 0) throw new Error('No certificates supplied');
  const userCert = certs[0];

  // certificate verify
  const certVerifyHandshakeData = hs.data.subarray(0, hs.offset);
  const certVerifyData = concat(hellos, certVerifyHandshakeData);
  const certVerifyHashBuffer = await cs.digest('SHA-256', certVerifyData);
  const certVerifyHash = new Uint8Array(certVerifyHashBuffer);
  const certVerifySignedData = concat(txtEnc.encode(' '.repeat(64) + 'TLS 1.3, server CertificateVerify'), [0x00], certVerifyHash);

  await hs.expectUint8(0x0f, chatty && 'handshake message type: certificate verify ([RFC 8446 §4.4.3](https://datatracker.ietf.org/doc/html/rfc8446#section-4.4.3))');
  const [endCertVerifyPayload] = await hs.expectLengthUint24(chatty && 'handshake message data');
  const sigType = await hs.readUint16();

  chatty && log('verifying end-user certificate ...');
  if (sigType === 0x0403) {
    chatty && hs.comment('signature type ECDSA-SECP256R1-SHA256');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3
    const [endSignature] = await hs.expectLengthUint16();
    await ecdsaVerify(hs, userCert.publicKey.all, certVerifySignedData, 'P-256', 'SHA-256');
    endSignature();

  } else if (sigType === 0x0804) {
    chatty && hs.comment('signature type RSA-PSS-RSAE-SHA256');
    const [endSignature, signatureRemaining] = await hs.expectLengthUint16();
    const signature = await hs.subarrayForRead(signatureRemaining());
    chatty && hs.comment('signature');
    endSignature();

    /*
    RSASSA-PSS RSAE algorithms:  Indicates a signature algorithm using
    RSASSA-PSS [RFC8017] with mask generation function 1.  The digest
    used in the mask generation function and the digest being signed
    are both the corresponding hash algorithm as defined in [SHS].
    The length of the Salt MUST be equal to the length of the output
    of the digest algorithm.  If the public key is carried in an X.509
    certificate, it MUST use the rsaEncryption OID [RFC5280].
    -- https://www.rfc-editor.org/rfc/rfc8446#section-4.2.3
    */
    const signatureKey = await cs.importKey('spki', userCert.publicKey.all, { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['verify']);
    const certVerifyResult = await cs.verify({ name: 'RSA-PSS', saltLength: 32 /* SHA-256 length in bytes */ }, signatureKey, signature, certVerifySignedData);
    if (certVerifyResult !== true) throw new Error('RSA-PSS-RSAE-SHA256 certificate verify failed');

  } else {
    throw new Error(`Unsupported certificate verify signature type 0x${hexFromU8([sigType]).padStart(4, '0')}`);
  }

  chatty && log('%c✓ end-user certificate verified (server has private key)', 'color: #8c8;');  // if not, we'd have thrown by now
  endCertVerifyPayload();

  // handshake verify
  const verifyHandshakeData = hs.data.subarray(0, hs.offset);
  const verifyData = concat(hellos, verifyHandshakeData);
  const finishedKey = await hkdfExpandLabel(serverSecret, 'finished', new Uint8Array(0), 32, 256);
  const finishedHash = await cs.digest('SHA-256', verifyData);
  const hmacKey = await cs.importKey('raw', finishedKey, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign']);
  const correctVerifyHashBuffer = await cs.sign('HMAC', hmacKey, finishedHash);
  const correctVerifyHash = new Uint8Array(correctVerifyHashBuffer);

  await hs.expectUint8(0x14, chatty && 'handshake message type: finished ([RFC 8446 §4.4.4](https://datatracker.ietf.org/doc/html/rfc8446#section-4.4.4))');
  const [endHsFinishedPayload, hsFinishedPayloadRemaining] = await hs.expectLengthUint24(chatty && 'verify hash');
  const verifyHash = await hs.readBytes(hsFinishedPayloadRemaining());
  chatty && hs.comment('verify hash');
  endHsFinishedPayload();

  if (hs.readRemaining() !== 0) throw new Error('Unexpected extra bytes in server handshake');

  const verifyHashVerified = equal(verifyHash, correctVerifyHash);
  if (verifyHashVerified !== true) throw new Error('Invalid server verify hash');

  chatty && log('Decrypted using the server handshake key, the server’s handshake messages are parsed as follows ([source](https://github.com/jawj/subtls/blob/main/src/tls/readEncryptedHandshake.ts)). This is a long section, since X.509 certificates are quite complex and there will be several of them:');
  chatty && log(...highlightBytes(hs.commentedString(), LogColours.server));

  const verifiedToTrustedRoot = await verifyCerts(host, certs, rootCertsDatabase, requireServerTlsExtKeyUsage, requireDigitalSigKeyUsage);
  if (!verifiedToTrustedRoot) throw new Error('Validated certificate chain did not end in a trusted root');

  return { handshakeData: hs.data.subarray(0, hs.offset), clientCertRequested, userCert } as const;
}
