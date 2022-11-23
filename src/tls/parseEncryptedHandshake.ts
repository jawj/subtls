import { LogColours } from '../presentation/appearance';
import { hkdfExpandLabel } from './keys';
import { concat, equal } from '../util/array';

import { Cert } from './cert';
import { highlightBytes, highlightColonList } from '../presentation/highlights';
import { log } from '../presentation/log';
import { getRootCerts } from './rootCerts';
import { constructedUniversalTypeSequence, universalTypeInteger } from './certUtils';
import { ASN1Bytes } from '../util/asn1bytes';
import { hexFromU8 } from '../util/hex';

const txtEnc = new TextEncoder();

export async function parseEncryptedHandshake(host: string, record: Uint8Array, serverSecret: Uint8Array, hellos: Uint8Array) {
  const hs = new ASN1Bytes(record);

  // parse encrypted handshake part
  const [endHs] = hs.expectLength(record.length, 0);

  hs.expectUint8(0x08, chatty && 'handshake record type: encrypted extensions');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.1
  const [eeMessageEnd] = hs.expectLengthUint24();
  const [extEnd, extRemaining] = hs.expectLengthUint16(chatty && 'extensions');
  /* 
   "A server that receives a client hello containing the "server_name"
   extension MAY use the information contained in the extension to guide
   its selection of an appropriate certificate to return to the client,
   and / or other aspects of security policy. In this event, the server
   SHALL include an extension of type "server_name" in the (extended)
   server hello. The "extension_data" field of this extension SHALL be empty.
   - https://datatracker.ietf.org/doc/html/rfc6066#section-3
  */
  if (extRemaining() > 0) {
    hs.expectUint16(0x00, chatty && 'extension type: SNI');
    hs.expectUint16(0x00, chatty && 'no extension data');
  }
  extEnd();
  eeMessageEnd();

  // certificates
  hs.expectUint8(0x0b, chatty && 'handshake message type: server certificate');
  const [endCertPayload] = hs.expectLengthUint24(chatty && 'certificate payload');

  hs.expectUint8(0x00, chatty && '0 bytes of request context follow');
  const [endCerts, certsRemaining] = hs.expectLengthUint24(chatty && 'certificates');

  const certs: Cert[] = [];
  while (certsRemaining() > 0) {
    const [endCert] = hs.expectLengthUint24(chatty && 'certificate');
    const cert = new Cert(hs);  // this parses the cert and advances the offset
    certs.push(cert);
    endCert();

    const [endCertExt, certExtRemaining] = hs.expectLengthUint16();
    const certExtData = hs.subarray(certExtRemaining());  // TODO: use this for anything?
    endCertExt();
  }
  endCerts();
  endCertPayload();

  if (certs.length === 0) throw new Error('No certificates supplied');
  const userCert = certs[0];

  // certificate verify
  const certVerifyHandshakeData = hs.uint8Array.subarray(0, hs.offset);
  const certVerifyData = concat(hellos, certVerifyHandshakeData);
  const certVerifyHashBuffer = await crypto.subtle.digest('SHA-256', certVerifyData);
  const certVerifyHash = new Uint8Array(certVerifyHashBuffer);
  const certVerifySignedData = concat(txtEnc.encode(' '.repeat(64) + 'TLS 1.3, server CertificateVerify'), [0x00], certVerifyHash);

  hs.expectUint8(0x0f, chatty && 'handshake message type: certificate verify');
  const [endCertVerifyPayload] = hs.expectLengthUint24(chatty && 'handshake message data');
  const sigType = hs.readUint16();

  if (sigType === 0x0403) {
    chatty && hs.comment('signature type ECDSA-SECP256R1-SHA256');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3
    const [endSignature] = hs.expectLengthUint16();
    hs.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
    const [endSigDer] = hs.expectASN1Length(chatty && 'sequence');

    hs.expectUint8(universalTypeInteger, chatty && 'integer');
    const [endSigRBytes, sigRBytesRemaining] = hs.expectASN1Length(chatty && 'integer');
    let sigR = hs.readBytes(sigRBytesRemaining());
    chatty && hs.comment('signature: r');
    endSigRBytes();

    hs.expectUint8(universalTypeInteger, chatty && 'integer');
    const [endSigSBytes, sigSBytesRemaining] = hs.expectASN1Length(chatty && 'integer');
    let sigS = hs.readBytes(sigSBytesRemaining());
    chatty && hs.comment('signature: s');
    endSigSBytes();

    endSigDer();
    endSignature();

    /*
    it seems WebCrypto expects a 64-byte P1363 signature, which sometimes discards a leading zero on r and s that's added to indicate positive sign
    - https://crypto.stackexchange.com/questions/57731/ecdsa-signature-rs-to-asn1-der-encoding-question
    - https://crypto.stackexchange.com/questions/1795/how-can-i-convert-a-der-ecdsa-signature-to-asn-1/1797#1797
    - https://stackoverflow.com/a/65403229
    */

    const clampToLength = (x: Uint8Array, clampLength: number) =>
      x.length > clampLength ? x.subarray(x.length - clampLength) :  // too long? cut off leftmost bytes (msb)
        x.length < clampLength ? concat(new Uint8Array(clampLength - x.length), x) : // too short? left pad with zeroes
          x;  // right length: pass through

    const signature = concat(clampToLength(sigR, 32), clampToLength(sigS, 32));

    // const signatureKey = await crypto.subtle.importKey('raw', userCert.publicKey.data, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const signatureKey = await crypto.subtle.importKey('spki', userCert.publicKey.all, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const certVerifyResult = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signatureKey, signature, certVerifySignedData);
    if (certVerifyResult !== true) throw new Error('ECDSA-SECP256R1-SHA256 certificate verify failed');

  } else if (sigType === 0x0804) {  // 
    chatty && hs.comment('signature type RSA-PSS-RSAE-SHA256');
    const [endSignature, signatureRemaining] = hs.expectLengthUint16();
    const signature = hs.subarray(signatureRemaining());
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
    console.log(hexFromU8(userCert.publicKey.all, ' '));
    const signatureKey = await crypto.subtle.importKey('spki', userCert.publicKey.all, { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['verify']);
    const certVerifyResult = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 /* SHA-256 length in bytes */ }, signatureKey, signature, certVerifySignedData);
    if (certVerifyResult !== true) throw new Error('RSA-PSS-RSAE-SHA256 certificate verify failed');

  } else {
    throw new Error(`Unsupported certificate verify signature type 0x${hexFromU8([sigType]).padStart(4, '0')}`);
  }

  endCertVerifyPayload();

  // handshake verify
  const verifyHandshakeData = hs.uint8Array.subarray(0, hs.offset);
  const verifyData = concat(hellos, verifyHandshakeData);
  const finishedKey = await hkdfExpandLabel(serverSecret, 'finished', new Uint8Array(0), 32, 256);
  const finishedHash = await crypto.subtle.digest('SHA-256', verifyData);
  const hmacKey = await crypto.subtle.importKey('raw', finishedKey, { name: 'HMAC', hash: { name: `SHA-256` } }, false, ['sign']);
  const correctVerifyHashBuffer = await crypto.subtle.sign('HMAC', hmacKey, finishedHash);
  const correctVerifyHash = new Uint8Array(correctVerifyHashBuffer);

  hs.expectUint8(0x14, chatty && 'handshake message type: finished');
  const [endHsFinishedPayload, hsFinishedPayloadRemaining] = hs.expectLengthUint24(chatty && 'verify hash');
  const verifyHash = hs.readBytes(hsFinishedPayloadRemaining());
  chatty && hs.comment('verify hash');
  endHsFinishedPayload();

  endHs();

  const verifyHashVerified = equal(verifyHash, correctVerifyHash);
  if (verifyHashVerified !== true) throw new Error('Invalid server verify hash');


  chatty && log(...highlightBytes(hs.commentedString(true), LogColours.server));


  chatty && log('%c%s', `color: ${LogColours.header}`, 'certificates');
  for (const cert of certs) chatty && log(...highlightColonList(cert.description()));

  chatty && log('%c✓ end-user certificate verified: server has private key', 'color: #8c8;');  // if not, we'd have thrown by now

  const namesMatch = userCert.subjectAltNamesMatch(host);
  if (!namesMatch) throw new Error(`No matching subjectAltName for ${host}`);

  chatty && log('%c✓ server verify hash validated', 'color: #8c8;');  // if not, we'd have thrown by now

  // TODO: trustidx3root makes neon-cf-pg-test.jawj.workers.dev work, even though it's expired.
  // Is this OK? https://scotthelme.co.uk/should-clients-care-about-the-expiration-of-a-root-certificate/
  const rootCerts = getRootCerts();

  chatty && log('%c%s', `color: ${LogColours.header}`, 'trusted root certificates');
  for (const cert of rootCerts) chatty && log(...highlightColonList(cert.description()));

  // TODO: build and verify certificate chain
}


