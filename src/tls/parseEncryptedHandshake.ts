import { LogColours } from '../presentation/appearance';
import { hkdfExpandLabel } from './keys';
import { concat, equal } from '../util/array';

import { Cert } from './cert';
import { highlightBytes, highlightColonList } from '../presentation/highlights';
import { log } from '../presentation/log';
import { getRootCerts } from './rootCerts';
import { constructedUniversalTypeSequence, universalTypeInteger } from './certUtils';
import { ASN1Bytes } from '../util/asn1bytes';

const txtEnc = new TextEncoder();

export async function parseEncryptedHandshake(host: string, record: Uint8Array, serverSecret: Uint8Array, hellos: Uint8Array) {
  // parse encrypted handshake part
  const hs = new ASN1Bytes(record);
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

  hs.expectUint8(0x0b, chatty && 'handshake message type: server certificate');
  const [endCertPayload] = hs.expectLengthUint24(chatty && 'certificate payload');

  hs.expectUint8(0x00, chatty && '0 bytes of request context follow');
  const [endCerts, certsRemaining] = hs.expectLengthUint24(chatty && 'certificates');

  const certs: Cert[] = [];
  while (certsRemaining() > 0) {
    const [endCert] = hs.expectLengthUint24(chatty && 'certificate');

    const cert = new Cert(hs);  // this parses the cert and advances the offset
    certs.push(cert);

    chatty && hs.comment('server certificate');
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
  hs.expectUint16(0x0403, chatty && 'signature type ecdsa_secp256r1_sha256');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3
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
  endCertVerifyPayload();

  // it seems WebCrypto expects a 64-byte P1363 signature, which sometimes discards a leading zero on r and s that's added to indicate positive sign
  // https://crypto.stackexchange.com/questions/57731/ecdsa-signature-rs-to-asn1-der-encoding-question
  // https://crypto.stackexchange.com/questions/1795/how-can-i-convert-a-der-ecdsa-signature-to-asn-1/1797#1797
  // https://stackoverflow.com/a/65403229

  const clampToLength = (x: Uint8Array, clampLength: number) =>
    // if longer, cut off leftmost bytes (most significant on Big Endian)
    x.length > clampLength ? x.subarray(x.length - clampLength) :
      // if shorter, left pad with zero bytes
      x.length < clampLength ? concat(new Uint8Array(clampLength - x.length), x) :
        // if neither, nothing to do!
        x;

  const signature = concat(clampToLength(sigR, 32), clampToLength(sigS, 32));
  const signatureKey = await crypto.subtle.importKey('raw', userCert.publicKey.data, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const certVerifyResult = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signatureKey, signature, certVerifySignedData);
  if (certVerifyResult !== true) throw new Error('Certificate verify failed');

  // handshake finished and verify
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

  // logging
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