import * as pkijs from 'pkijs';
import { Colours } from './colours';

import Bytes from './util/bytes';
import { certNamesMatch, getRootCerts, describeCert, getSubjectAltNamesDNSNames } from './util/cert';
import highlightCommented from './util/highlightCommented';

export async function parseEncryptedHandshake(host: string, unwrappedRecord: Uint8Array) {
  // parse encrypted handshake part
  const hs = new Bytes(unwrappedRecord);

  hs.expectUint8(0x08, 'handshake record type: encrypted extensions');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.1
  const eeMessageLength = hs.readUint24('% bytes of handshake data follows');
  if (eeMessageLength !== 2 && eeMessageLength !== 6) throw new Error('Unexpected extensions length');
  const extLength = hs.readUint16('% bytes of extensions data follow');
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
    if (extLength !== 4) throw new Error('Unexpected extensions');
    hs.expectUint16(0x00, 'extension type: SNI');
    hs.expectUint16(0x00, 'no extension data');
  }

  hs.expectUint8(0x0b, 'handshake message type: server certificate');
  const certPayloadLength = hs.readUint24('% bytes of certificate payload follow');
  hs.expectUint8(0x00, '0 bytes of request context follow');
  let remainingCertsLength = hs.readUint24('% bytes of certificates follow');
  if (remainingCertsLength !== certPayloadLength - 4) throw new Error('Mystery extra certificate payload');

  const certEntries = [];
  while (remainingCertsLength > 0) {
    const certLength = hs.readUint24('% bytes of certificate follow');
    remainingCertsLength -= 3;

    const certData = hs.readBytes(certLength);
    hs.comment('server certificate');
    remainingCertsLength -= certLength;

    const certExtLength = hs.readUint16('% bytes of certificate extensions follow');
    remainingCertsLength -= 2;

    const certExtData = hs.readBytes(certExtLength);
    remainingCertsLength -= certExtLength;

    const cert = pkijs.Certificate.fromBER(certData);
    certEntries.push({ certData, certExtData, cert });
  }

  if (certEntries.length === 0) throw new Error('No certificates supplied');

  console.log('%c%s', `color: ${Colours.header}`, 'certificates');
  for (const entry of certEntries) console.log(describeCert(entry.cert));

  const userCert = certEntries[0].cert;
  const altNames = getSubjectAltNamesDNSNames(userCert);

  const namesMatch = certNamesMatch(host, altNames);
  if (!namesMatch) throw new Error(`No matching subjectAltName for ${host}`);

  // TODO: trustidx3root makes neon-cf-pg-test.jawj.workers.dev work, even though it's expired.
  // Is this OK? https://scotthelme.co.uk/should-clients-care-about-the-expiration-of-a-root-certificate/
  const rootCerts = getRootCerts();

  console.log('%c%s', `color: ${Colours.header}`, 'trusted root certificates');
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
  const signatureType = hs.readUint16('signature type');
  const signatureLength = hs.readUint16('signature length');
  const signature = hs.readBytes(signatureLength);
  hs.comment('signature');

  hs.expectUint8(0x14, 'handshake message type: finished');
  const hsFinishedPayloadLength = hs.readUint24('% bytes of handshake message data follow');
  const verifyHash = hs.readBytes(hsFinishedPayloadLength);
  hs.comment('verify hash');

  console.log(...highlightCommented(hs.commentedString(true), Colours.server));

  if (hs.remainingBytes() !== 0) throw new Error('Unexpected extra bytes at end of encrypted handshake');
}