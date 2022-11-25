import { LogColours } from '../presentation/appearance';
import { hkdfExpandLabel } from './keys';
import { concat, equal } from '../util/array';

import { Cert, TrustedCert } from './cert';
import { highlightBytes, highlightColonList } from '../presentation/highlights';
import { log } from '../presentation/log';
import { getRootCerts } from './rootCerts';
import { ASN1Bytes } from '../util/asn1bytes';
import { hexFromU8 } from '../util/hex';
import { ecdsaVerify } from './ecdsa';

const txtEnc = new TextEncoder();

export async function readEncryptedHandshake(host: string, readHandshakeRecord: () => Promise<Uint8Array>, serverSecret: Uint8Array, hellos: Uint8Array) {
  const hs = new ASN1Bytes(await readHandshakeRecord());

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
  if (hs.remaining() === 0) hs.extend(await readHandshakeRecord());
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

  if (hs.remaining() === 0) hs.extend(await readHandshakeRecord());
  hs.expectUint8(0x0f, chatty && 'handshake message type: certificate verify');
  const [endCertVerifyPayload] = hs.expectLengthUint24(chatty && 'handshake message data');
  const sigType = hs.readUint16();

  chatty && log('verifying end-user certificate ...');
  if (sigType === 0x0403) {
    chatty && hs.comment('signature type ECDSA-SECP256R1-SHA256');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3
    const [endSignature] = hs.expectLengthUint16();
    await ecdsaVerify(hs, userCert.publicKey.all, certVerifySignedData, 'P-256', 'SHA-256');
    endSignature();

  } else if (sigType === 0x0804) {
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

  if (hs.remaining() === 0) hs.extend(await readHandshakeRecord());
  hs.expectUint8(0x14, chatty && 'handshake message type: finished');
  const [endHsFinishedPayload, hsFinishedPayloadRemaining] = hs.expectLengthUint24(chatty && 'verify hash');
  const verifyHash = hs.readBytes(hsFinishedPayloadRemaining());
  chatty && hs.comment('verify hash');
  endHsFinishedPayload();

  if (hs.remaining() !== 0) throw new Error('Unexpected surplus bytes in server handshake');

  const verifyHashVerified = equal(verifyHash, correctVerifyHash);
  if (verifyHashVerified !== true) throw new Error('Invalid server verify hash');

  chatty && log(...highlightBytes(hs.commentedString(true), LogColours.server));

  chatty && log('%c%s', `color: ${LogColours.header}`, 'certificates');
  for (const cert of certs) chatty && log(...highlightColonList(cert.description()));

  // end-user certificate checks
  chatty && log('%c✓ end-user certificate verified (server has private key)', 'color: #8c8;');  // if not, we'd have thrown by now

  const matchingSubjectAltName = userCert.subjectAltNameMatchingHost(host);
  if (matchingSubjectAltName === undefined) throw new Error(`No matching subjectAltName for ${host}`);
  chatty && log(`%c✓ matched host to subjectAltName "${matchingSubjectAltName}"`, 'color: #8c8;');

  const validNow = userCert.isValidAtMoment();
  if (!validNow) throw new Error('End-user certificate is not valid now');
  chatty && log(`%c✓ end-user certificate is valid now`, 'color: #8c8;');

  if (!userCert.extKeyUsage?.serverTls) throw new Error('Signing certificate has no TLS server extKeyUsage');
  chatty && log(`%c✓ end-user certificate has TLS server extKeyUsage`, 'color: #8c8;');

  // certificate chain checks
  const rootCerts = getRootCerts();
  let verifiedToTrustedRoot = false;

  chatty && log('%c%s', `color: ${LogColours.header}`, 'trusted root certificates');
  for (const cert of rootCerts) chatty && log(...highlightColonList(cert.description()));

  for (let i = 0, len = certs.length; i < len; i++) {
    const subjectCert = certs[i];
    const subjectAuthKeyId = subjectCert.authorityKeyIdentifier;
    if (subjectAuthKeyId === undefined) throw new Error('Certificates without an authorityKeyIdentifier are not supported');

    // first, see if any trusted root cert has a subjKeyId matching the authKeyId
    let signingCert: Cert | undefined = rootCerts.find(cert =>
      cert.subjectKeyIdentifier !== undefined && equal(cert.subjectKeyIdentifier, subjectAuthKeyId));

    // if not, see if any later supplied cert has a subjKeyId matching the authKeyId
    if (signingCert === undefined && i < certs.length - 1) signingCert = certs.slice(i + 1).find(cert =>
      cert.subjectKeyIdentifier !== undefined && equal(cert.subjectKeyIdentifier, subjectAuthKeyId));

    // if still not, give up
    if (signingCert === undefined) throw new Error('No matches found among trusted certificates or supplied chain');
    chatty && log('matched certs on key id %s', hexFromU8(subjectAuthKeyId));

    const signingCertIsTrustedRoot = signingCert instanceof TrustedCert;
    if (!signingCert.isValidAtMoment()) throw new Error('Signing certificate is not valid now');
    if (!signingCert.keyUsage?.usages.has('digitalSignature')) throw new Error('Signing certificate keyUsage does not include digital signatures');
    if (signingCert.basicConstraints?.ca !== true) throw new Error('Signing certificate basicConstraints do not indicate a CA certificate');
    // TODO: check pathLength

    // verify cert chain signature
    chatty && log(`verifying certificate CN "${subjectCert.subject.CN}" is signed by ${signingCertIsTrustedRoot ? 'trusted root' : 'intermediate'} certificate CN "${signingCert.subject.CN}" ...`);
    if (subjectCert.algorithm === '1.2.840.10045.4.3.2' || subjectCert.algorithm === '1.2.840.10045.4.3.3') {  // ECDSA + SHA256/384
      const hash = subjectCert.algorithm === '1.2.840.10045.4.3.2' ? 'SHA-256' : 'SHA-384';
      const signingKeyOIDs = signingCert.publicKey.identifiers;
      const namedCurve = signingKeyOIDs.includes('1.2.840.10045.3.1.7') ? 'P-256' : signingKeyOIDs.includes('1.3.132.0.34') ? 'P-384' : undefined;
      if (namedCurve === undefined) throw new Error('Unsupported signing key curve');

      const sb = new ASN1Bytes(subjectCert.signature);
      await ecdsaVerify(sb, signingCert.publicKey.all, subjectCert.signedData, namedCurve, hash);

    } else if (subjectCert.algorithm === '1.2.840.113549.1.1.11') {  // RSASSA_PKCS1-v1_5 + SHA-256
      const signatureKey = await crypto.subtle.importKey('spki', signingCert.publicKey.all, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      const certVerifyResult = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, signatureKey, subjectCert.signature, subjectCert.signedData);
      if (certVerifyResult !== true) throw new Error('RSASSA_PKCS1-v1_5-SHA256 certificate verify failed');
      chatty && log(`%c✓ RSASAA-PKCS1-v1_5-SHA256 signature verified`, 'color: #8c8;');

    } else {
      throw new Error('Unsupported signing algorithm');
    }

    if (signingCertIsTrustedRoot) {
      verifiedToTrustedRoot = true;
      break;
    }
  }

  if (!verifiedToTrustedRoot) throw new Error('Validated certificate chain did not end in trusted root');
  return hs.uint8Array;
}
