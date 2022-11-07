import * as pkijs from 'pkijs';
import * as pvtsutils from 'pvtsutils';

import highlightCommented from './util/highlightCommented';
import makeClientHello from './clientHello';
import { ReadQueue } from './util/readqueue';
import { readTlsRecord, RecordTypes } from './util/tlsrecord';
import Bytes from './util/bytes';
import parseServerHello from './parseServerHello';
import { getHandshakeKeys } from './keyscalc';
import { hexFromU8 } from './util/hex';
import { Decrypter } from './aesgcm';
import { concat } from './util/array';
import { describeCert } from './util/cert';

// @ts-ignore
import isrgrootx1 from './roots/isrg-root-x1.pem';
// @ts-ignore
import isrgrootx2 from './roots/isrg-root-x2.pem';
// @ts-ignore
import isrgrootx2xs from './roots/isrg-root-x1-cross-signed.pem';
// @ts-ignore
import trustidx3root from './roots/trustid-x3-root.pem';


const clientColour = '#8c8';
const serverColour = '#88c';
const headerColor = '#c88';

async function startTls(host: string, port: number) {
  const ecdhKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true /* extractable */, ['deriveKey', 'deriveBits']);
  const rawPublicKey = await crypto.subtle.exportKey('raw', ecdhKeys.publicKey);

  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
  });

  const reader = new ReadQueue(ws);

  // client hello
  const { clientHello, sessionId } = makeClientHello(host, rawPublicKey);
  console.log(...highlightCommented(clientHello.commentedString(), clientColour));
  const clientHelloData = clientHello.array();
  ws.send(clientHelloData);

  // server hello
  const serverHelloRecord = await readTlsRecord(reader, RecordTypes.Handshake);
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverRawPublicKey = parseServerHello(serverHello, sessionId);
  console.log(...highlightCommented(serverHelloRecord.header.commentedString() + serverHello.commentedString(), serverColour));

  // dummy cipher change
  const changeCipherRecord = await readTlsRecord(reader, RecordTypes.ChangeCipherSpec);
  const ccipher = new Bytes(changeCipherRecord.content);
  ccipher.expectUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  if (ccipher.remainingBytes() !== 0) throw new Error(`Unexpected additional data at end of ChangeCipherSpec`);
  console.log(...highlightCommented(changeCipherRecord.header.commentedString() + ccipher.commentedString(), serverColour));

  console.log('%c%s', `color: ${headerColor}`, 'handshake key computations');

  // shared secret
  const serverPublicKey = await crypto.subtle.importKey('raw', serverRawPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false /* extractable */, []);
  const sharedSecretBuffer = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, ecdhKeys.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  console.log('shared secret', hexFromU8(sharedSecret));

  // hash of client + server hellos (SHA-384 for AES256_SHA384, SHA256 for AES128_SHA256)
  const clientHelloContent = clientHelloData.subarray(5);  // cut off the 5-byte record header
  const serverHelloContent = serverHelloRecord.content;  // 5-byte record header is already excluded
  const hellos = concat(clientHelloContent, serverHelloContent);
  const hellosHashBuffer = await crypto.subtle.digest('SHA-256', hellos);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  console.log('hellos hash', hexFromU8(hellosHash));

  // keys
  const handshakeKeys = await getHandshakeKeys(sharedSecret, hellosHash, 256, 16);  // would be 384, 32 for AES256_SHA384
  const serverHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.serverHandshakeKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const handshakeDecrypter = new Decrypter(serverHandshakeKey, handshakeKeys.serverHandshakeIV);

  // encrypted handshake part
  const encrypted = await readTlsRecord(reader, RecordTypes.Application);
  console.log(...highlightCommented(encrypted.header.commentedString(), serverColour));
  console.log('%s%c  %s', hexFromU8(encrypted.content), `color: ${serverColour}`, 'encrypted payload + auth tag');

  const decrypted = await handshakeDecrypter.decrypt(encrypted.content, 16, encrypted.headerData);
  console.log('%s%c  %s', hexFromU8(decrypted), `color: ${serverColour}`, 'decrypted payload');

  // parse encrypted handshake part
  const hs = new Bytes(decrypted);

  hs.expectUint8(0x08, 'handshake record type: encrypted extensions');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.1
  const eeMessageLength = hs.readUint24('% bytes of handshake data follows');
  const extLength = hs.readUint16('% bytes of extensions data follow');
  /* 
   "A server that receives a client hello containing the "server_name"
   extension MAY use the information contained in the extension to guide
   its selection of an appropriate certificate to return to the client,
   and / or other aspects of security policy.In this event, the server
   SHALL include an extension of type "server_name" in the(extended)
   server hello.The "extension_data" field of this extension SHALL be
   empty.
   - https://datatracker.ietf.org/doc/html/rfc6066#section-3
  */
  if (extLength > 0) {
    if (extLength !== 4) throw new Error('Unexpected extensions');
    hs.expectUint16(0x00, 'extension type: SNI');
    hs.expectUint16(0x00, 'no extension data');
  }

  hs.expectUint8(0x0b, 'handshake record type: server certificate');
  const certPayloadLength = hs.readUint24('% bytes of certificate payload follow');
  hs.expectUint8(0x00, '0 bytes of request context follow');
  let remainingCertsLength = hs.readUint24('% bytes of certificates follow');
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

  console.log(...highlightCommented(hs.commentedString(true), serverColour));

  console.log('%c%s', `color: ${headerColor}`, 'certificates');
  for (const entry of certEntries) console.log(describeCert(entry.cert));

  const userCert = certEntries[0].cert;
  const subjectAltNameID = '2.5.29.17';
  const subectAltNameTypeDNSName = 2;
  const sanExtension = (userCert.extensions ?? []).find(ext => ext.extnID === subjectAltNameID);
  if (sanExtension === undefined) throw new Error('User certificate includes no subjectAltName extension');
  const altNames = (sanExtension.parsedValue as pkijs.AltName).altNames
    .filter(altName => altName.type === subectAltNameTypeDNSName)
    .map(altName => altName.value as string);

  console.log('subjectAltNames', altNames.join(' '));
  const namesMatch = altNames.some(alt => {
    let altName = alt;
    let hostName = host;
    // wildcards: https://en.wikipedia.org/wiki/Wildcard_certificate
    if (/[.][^.]+[.][^.]+/.test(altName) && altName.startsWith('*.')) {
      altName = alt.slice(1);
      hostName = hostName.slice(hostName.indexOf('.'));
    }
    // test
    if (altName === hostName) {
      console.log(`matched subjectAltName "${alt}"`);  // NOT altName!
      return true;
    }
  });
  if (!namesMatch) throw new Error(`No matching subjectAltName for ${host}`);

  function decodePEM(pem: string, tag = "[A-Z0-9 ]+") {
    const pattern = new RegExp(`-{5}BEGIN ${tag}-{5}([a-zA-Z0-9=+\\/\\n\\r]+)-{5}END ${tag}-{5}`, 'g');
    const res = [];
    let matches = null;
    while (matches = pattern.exec(pem)) {
      const base64 = matches[1].replace(/[\r\n]/g, '');
      res.push(pvtsutils.Convert.FromBase64(base64));
    }
    return res;
  }

  const trustedRootCerts = decodePEM(isrgrootx1 + isrgrootx2 + trustidx3root).map(ber => pkijs.Certificate.fromBER(ber));

  console.log('%c%s', `color: ${headerColor}`, 'trusted root certificates');
  for (const cert of trustedRootCerts) console.log(describeCert(cert));

  const chainEngine = new pkijs.CertificateChainValidationEngine({
    certs: certEntries.map(entry => entry.cert).reverse(),  // end-user cert should be last
    checkDate: new Date(),
    trustedCerts: trustedRootCerts,
  });

  const chain = await chainEngine.verify();
  console.log('cert verify result', chain);
  if (chain.result !== true) throw new Error(chain.resultMessage);


  // for validation, see https://pkijs.org/docs/classes/CertificateChainValidationEngine.html


}

startTls('neon-cf-pg-test.jawj.workers.dev', 443);
// calculateKeysTest();
