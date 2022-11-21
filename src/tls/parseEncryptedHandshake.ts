import { LogColours } from '../presentation/appearance';
import { hkdfExpandLabel } from './keys';
import { concat, equal } from '../util/array';

import Bytes from '../util/bytes';
import { Cert } from './cert';
import { highlightBytes, highlightColonList } from '../presentation/highlights';
import { log } from '../presentation/log';
import { getRootCerts } from './rootCerts';

export async function parseEncryptedHandshake(host: string, record: Uint8Array, serverSecret: Uint8Array, hellos: Uint8Array) {
  // parse encrypted handshake part
  const hs = new Bytes(record);
  const [endHs] = hs.expectLength(record.length);

  hs.expectUint8(0x08, 'handshake record type: encrypted extensions');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.1
  const [eeMessageEnd] = hs.expectLengthUint24();
  const [extEnd, extRemaining] = hs.expectLengthUint16('extensions');
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
    hs.expectUint16(0x00, 'extension type: SNI');
    hs.expectUint16(0x00, 'no extension data');
  }
  extEnd();
  eeMessageEnd();

  hs.expectUint8(0x0b, 'handshake message type: server certificate');
  const [endCertPayload] = hs.expectLengthUint24('certificate payload');

  hs.expectUint8(0x00, '0 bytes of request context follow');
  const [endCerts, certsRemaining] = hs.expectLengthUint24('certificates');

  const certEntries = [];
  while (certsRemaining() > 0) {
    const [endCert, certRemaining] = hs.expectLengthUint24('certificate');
    const certData = hs.readBytes(certRemaining());
    hs.comment('server certificate');
    endCert();

    const [endCertExt, certExtRemaining] = hs.expectLengthUint16();
    const certExtData = hs.readBytes(certExtRemaining());
    endCertExt();

    const cert = new Cert(certData);
    certEntries.push({ cert, certExtData });
  }
  endCerts();
  endCertPayload();

  if (certEntries.length === 0) throw new Error('No certificates supplied');

  chatty && log('%c%s', `color: ${LogColours.header}`, 'certificates');
  for (const entry of certEntries) chatty && log(...highlightColonList(entry.cert.description()));

  const userCert = certEntries[0].cert;
  const namesMatch = userCert.subjectAltNamesMatch(host);
  if (!namesMatch) throw new Error(`No matching subjectAltName for ${host}`);

  // TODO: trustidx3root makes neon-cf-pg-test.jawj.workers.dev work, even though it's expired.
  // Is this OK? https://scotthelme.co.uk/should-clients-care-about-the-expiration-of-a-root-certificate/
  const rootCerts = getRootCerts();

  chatty && log('%c%s', `color: ${LogColours.header}`, 'trusted root certificates');
  for (const cert of rootCerts) chatty && log(...highlightColonList(cert.description()));

  // cert verify
  hs.expectUint8(0x0f, 'handshake message type: certificate verify');
  const [endCertVerifyPayload] = hs.expectLengthUint24('handshake message data');
  const signatureType = hs.readUint16('signature type');
  const [endSignature, signatureRemaining] = hs.expectLengthUint16();
  const signature = hs.readBytes(signatureRemaining());
  hs.comment('signature');
  endSignature();
  endCertVerifyPayload();

  const verifyHandshakeData = hs.uint8Array.subarray(0, hs.offset);
  const verifyData = concat(hellos, verifyHandshakeData);
  const finishedKey = await hkdfExpandLabel(serverSecret, 'finished', new Uint8Array(0), 32, 256);
  const finishedHash = await crypto.subtle.digest('SHA-256', verifyData);
  const hmacKey = await crypto.subtle.importKey('raw', finishedKey, { name: 'HMAC', hash: { name: `SHA-256` } }, false, ['sign']);
  const correctVerifyHashBuffer = await crypto.subtle.sign('HMAC', hmacKey, finishedHash);
  const correctVerifyHash = new Uint8Array(correctVerifyHashBuffer);

  hs.expectUint8(0x14, 'handshake message type: finished');
  const [endHsFinishedPayload, hsFinishedPayloadRemaining] = hs.expectLengthUint24('verify hash');
  const verifyHash = hs.readBytes(hsFinishedPayloadRemaining());
  hs.comment('verify hash');
  endHsFinishedPayload();

  endHs();

  if (equal(verifyHash, correctVerifyHash)) chatty && log('server verify hash validated');
  else throw new Error('Invalid server verify hash');

  chatty && log(...highlightBytes(hs.commentedString(true), LogColours.server));
}