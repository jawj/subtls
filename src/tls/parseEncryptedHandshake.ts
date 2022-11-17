import * as pkijs from 'pkijs';
import { LogColours } from '../presentation/appearance';
import { hkdfExpandLabel } from './getKeys';
import { concat, equal } from '../util/array';

import Bytes from '../util/bytes';
import { certNamesMatch, getRootCerts, describeCert, getSubjectAltNamesDNSNames, parseCert } from './cert';
import highlightCommented from '../presentation/highlightCommented';

export async function parseEncryptedHandshake(host: string, record: Uint8Array, serverSecret: Uint8Array, hellos: Uint8Array) {
  // parse encrypted handshake part
  const hs = new Bytes(record);
  const [endHs] = hs.expectLength(record.length);

  hs.expectUint8(0x08, 'handshake record type: encrypted extensions');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.1
  const eeMessageLength = hs.readUint24('% bytes of handshake data follows');
  const [eeMessageEnd] = hs.expectLength(eeMessageLength);

  if (eeMessageLength !== 2 && eeMessageLength !== 6) throw new Error('Unexpected extensions length');
  const extLength = hs.readUint16('% bytes of extensions data follow');
  const [extEnd] = hs.expectLength(extLength);
  /* 
   "A server that receives a client hello containing the "server_name"
   extension MAY use the information contained in the extension to guide
   its selection of an appropriate certificate to return to the client,
   and / or other aspects of security policy. In this event, the server
   SHALL include an extension of type "server_name" in the (extended)
   server hello. The "extension_data" field of this extension SHALL be empty.
   - https://datatracker.ietf.org/doc/html/rfc6066#section-3
  */
  if (extLength > 0) {
    hs.expectUint16(0x00, 'extension type: SNI');
    hs.expectUint16(0x00, 'no extension data');
  }
  extEnd();
  eeMessageEnd();

  hs.expectUint8(0x0b, 'handshake message type: server certificate');
  const certPayloadLength = hs.readUint24('% bytes of certificate payload follow');
  const [endCertPayload] = hs.expectLength(certPayloadLength);

  hs.expectUint8(0x00, '0 bytes of request context follow');
  let remainingCertsLength = hs.readUint24('% bytes of certificates follow');
  const [endCerts, certsRemainingBytes] = hs.expectLength(remainingCertsLength);

  const certEntries = [];
  while (certsRemainingBytes() > 0) {
    const certLength = hs.readUint24('% bytes of certificate follow');
    const [endCert] = hs.expectLength(certLength);
    const certData = hs.readBytes(certLength);
    hs.comment('server certificate');
    endCert();

    const certExtLength = hs.readUint16('% bytes of certificate extensions follow');
    const [endCertExt] = hs.expectLength(certExtLength);
    const certExtData = hs.readBytes(certExtLength);
    endCertExt();

    const cert = pkijs.Certificate.fromBER(certData);
    certEntries.push({ certData, certExtData, cert });

    parseCert(certData);
  }
  endCerts();
  endCertPayload();

  if (certEntries.length === 0) throw new Error('No certificates supplied');

  console.log('%c%s', `color: ${LogColours.header}`, 'certificates');
  for (const entry of certEntries) console.log(describeCert(entry.cert));

  const userCert = certEntries[0].cert;
  const altNames = getSubjectAltNamesDNSNames(userCert);

  const namesMatch = certNamesMatch(host, altNames);
  if (!namesMatch) throw new Error(`No matching subjectAltName for ${host}`);

  // TODO: trustidx3root makes neon-cf-pg-test.jawj.workers.dev work, even though it's expired.
  // Is this OK? https://scotthelme.co.uk/should-clients-care-about-the-expiration-of-a-root-certificate/
  const rootCerts = getRootCerts();

  console.log('%c%s', `color: ${LogColours.header}`, 'trusted root certificates');
  for (const cert of rootCerts) console.log(describeCert(cert));

  const chainEngine = new pkijs.CertificateChainValidationEngine({
    certs: certEntries.map(entry => entry.cert).reverse(),  // end-user cert should be last
    trustedCerts: rootCerts,
  });

  const chain = await chainEngine.verify();
  console.log('cert verify result', chain);
  if (chain.result !== true) throw new Error(chain.resultMessage);

  hs.expectUint8(0x0f, 'handshake message type: certificate verify');
  const certVerifyPayloadLength = hs.readUint24('% bytes of handshake message data follow');
  const [endCertVerifyPayload] = hs.expectLength(certVerifyPayloadLength);
  const signatureType = hs.readUint16('signature type');
  const signatureLength = hs.readUint16('signature length');
  const [endSignature] = hs.expectLength(signatureLength);
  const signature = hs.readBytes(signatureLength);
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
  const hsFinishedPayloadLength = hs.readUint24('% bytes of handshake message data follow');
  const [endHsFinishedPayload] = hs.expectLength(hsFinishedPayloadLength);
  const verifyHash = hs.readBytes(hsFinishedPayloadLength);
  hs.comment('verify hash');
  endHsFinishedPayload();

  endHs();

  if (equal(verifyHash, correctVerifyHash)) console.log('server verify hash validated');
  else throw new Error('Invalid server verify hash');

  console.log(...highlightCommented(hs.commentedString(true), LogColours.server));
}