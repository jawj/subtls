
import highlightCommented from './util/highlightCommented';
import makeClientHello from './clientHello';
import { ReadQueue } from './util/readqueue';
import { readTlsRecord, RecordTypes, unwrapDecryptedTlsRecord } from './util/tlsrecord';
import Bytes from './util/bytes';
import parseServerHello from './parseServerHello';
import { getApplicationKeys, getHandshakeKeys, hkdfExpandLabel } from './keyscalc';
import { hexFromU8 } from './util/hex';
import { Crypter } from './aesgcm';
import { concat } from './util/array';
import { Colours } from './colours';
import { parseEncryptedHandshake } from './parseEncryptedHandshake';

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
  console.log(...highlightCommented(clientHello.commentedString(), Colours.client));
  const clientHelloData = clientHello.array();
  ws.send(clientHelloData);

  // server hello
  const serverHelloRecord = await readTlsRecord(reader, RecordTypes.Handshake);
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverRawPublicKey = parseServerHello(serverHello, sessionId);
  console.log(...highlightCommented(serverHelloRecord.header.commentedString() + serverHello.commentedString(), Colours.server));

  // dummy cipher change
  const changeCipherRecord = await readTlsRecord(reader, RecordTypes.ChangeCipherSpec);
  const ccipher = new Bytes(changeCipherRecord.content);
  ccipher.expectUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  if (ccipher.remainingBytes() !== 0) throw new Error(`Unexpected additional data at end of ChangeCipherSpec`);
  console.log(...highlightCommented(changeCipherRecord.header.commentedString() + ccipher.commentedString(), Colours.server));

  console.log('%c%s', `color: ${Colours.header}`, 'handshake key computations');

  // shared secret
  const serverPublicKey = await crypto.subtle.importKey('raw', serverRawPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false /* extractable */, []);
  const sharedSecretBuffer = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, ecdhKeys.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  console.log('shared secret', hexFromU8(sharedSecret));

  // hash of client + server hellos (SHA-384 for AES256_SHA384, SHA256 for AES128_SHA256)
  const clientHelloContent = clientHelloData.subarray(5);  // cut off the 5-byte record header
  const serverHelloContent = serverHelloRecord.content;  // 5-byte record header is already excluded
  const hellos = concat(clientHelloContent, serverHelloContent);
  // note: we could improve efficiency with Cloudflare's DigestStream by avoiding a concat
  const hellosHashBuffer = await crypto.subtle.digest('SHA-256', hellos);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  console.log('hellos hash', hexFromU8(hellosHash));

  // keys
  const handshakeKeys = await getHandshakeKeys(sharedSecret, hellosHash, 256, 16);  // would be 384, 32 for AES256_SHA384
  const serverHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.serverHandshakeKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const handshakeDecrypter = new Crypter('decrypt', serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.clientHandshakeKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const handshakeEncrypter = new Crypter('encrypt', clientHandshakeKey, handshakeKeys.clientHandshakeIV);

  // encrypted part of server handshake
  const encHandshake = await readTlsRecord(reader, RecordTypes.Application);
  console.log(...highlightCommented(encHandshake.header.commentedString(), Colours.server));
  console.log('%s%c  %s', hexFromU8(encHandshake.content), `color: ${Colours.server}`, 'encrypted payload + auth tag');

  const decHandshake = await handshakeDecrypter.process(encHandshake.content, 16, encHandshake.headerData);
  console.log('%s%c  %s', hexFromU8(decHandshake), `color: ${Colours.server}`, 'decrypted payload');

  const unwrappedHandshake = unwrapDecryptedTlsRecord(decHandshake, RecordTypes.Handshake);
  await parseEncryptedHandshake(host, unwrappedHandshake.record);
  console.log('%s%c  %s', unwrappedHandshake.type.toString(16).padStart(2, '0'), `color: ${Colours.server}`, 'record type: handshake');

  // dummy cipher change
  const clientCipherChange = new Bytes(6);
  clientCipherChange.writeUint8(0x14, 'record type: ChangeCipherSpec');
  clientCipherChange.writeUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  clientCipherChange.writeUint16(0x0001, 'payload length: 1 byte');
  clientCipherChange.writeUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  console.log(...highlightCommented(clientCipherChange.commentedString(), Colours.client));
  const clientCipherChangeData = clientCipherChange.array();
  ws.send(clientCipherChangeData);

  // hash of whole handshake (cipher change excluded?)
  const wholeHandshake = concat(hellos, unwrappedHandshake.record);
  // note: we could improve efficiency with Cloudflare's DigestStream: avoid concat and just add more data to the hellosHash digest here
  const wholeHandshakeHashBuffer = await crypto.subtle.digest('SHA-256', wholeHandshake);
  const wholeHandshakeHash = new Uint8Array(wholeHandshakeHashBuffer);
  console.log('whole handshake hash', hexFromU8(wholeHandshakeHash));

  // client handshake finished
  const finishedKey = await hkdfExpandLabel(handshakeKeys.clientSecret, 'finished', new Uint8Array(0), 32 /* = hashBytes */, 256);
  const verifyHmacKey = await crypto.subtle.importKey('raw', finishedKey, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign']);
  const verifyDataBuffer = await crypto.subtle.sign('HMAC', verifyHmacKey, wholeHandshakeHash);
  const verifyData = new Uint8Array(verifyDataBuffer);

  const clientFinishedRecord = new Bytes(37);
  clientFinishedRecord.writeUint8(0x14, 'handshake message type: finished');
  const clientFinishedRecordEnd = clientFinishedRecord.lengthUint24('handshake finished data');
  clientFinishedRecord.writeBytes(verifyData);
  clientFinishedRecord.comment('verify data');
  clientFinishedRecordEnd();
  clientFinishedRecord.writeUint8(RecordTypes.Handshake, 'record type: Handshake');
  console.log(...highlightCommented(clientFinishedRecord.commentedString(), Colours.client));

  const encryptedLength = clientFinishedRecord.offset + 16 /* for the auth tag */;
  const encryptedClientFinishedRecord = new Bytes(5 + encryptedLength);
  encryptedClientFinishedRecord.writeUint8(0x17, 'record type: Application');
  encryptedClientFinishedRecord.writeUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  encryptedClientFinishedRecord.writeUint16(encryptedLength, `${encryptedLength} bytes follow`);
  const encHeader = encryptedClientFinishedRecord.array();
  const encryptedClientFinishedData = await handshakeEncrypter.process(clientFinishedRecord.array(), 16, encHeader);
  encryptedClientFinishedRecord.writeBytes(encryptedClientFinishedData);
  encryptedClientFinishedRecord.comment('encrypted data');
  console.log(...highlightCommented(encryptedClientFinishedRecord.commentedString(), Colours.client));
  ws.send(encryptedClientFinishedRecord.array());

  console.log('%c%s', `color: ${Colours.header}`, 'application key computations');

  // application keys
  const applicationKeys = await getApplicationKeys(handshakeKeys.handshakeSecret, wholeHandshakeHash, 256, 16);
  const clientApplicationKey = await crypto.subtle.importKey('raw', applicationKeys.clientApplicationKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const applicationEncrypter = new Crypter('encrypt', clientApplicationKey, applicationKeys.clientApplicationIV);
  const serverApplicationKey = await crypto.subtle.importKey('raw', applicationKeys.serverApplicationKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const applicationDecrypter = new Crypter('decrypt', serverApplicationKey, applicationKeys.serverApplicationIV);

  // GET
  const requestDataRecord = new Bytes(1024);
  requestDataRecord.writeUTF8String(`GET / HTTP/1.1\r\nHost:${host}\r\nConnection: close\r\n\r\n`);
  requestDataRecord.writeUint8(RecordTypes.Application, 'record type: Application');
  console.log(...highlightCommented(requestDataRecord.commentedString(), Colours.client));

  const encryptedReqLength = requestDataRecord.offset + 16 /* auth tag */;
  const encryptedReqRecord = new Bytes(5 + encryptedReqLength);
  encryptedReqRecord.writeUint8(0x17, 'record type: Application');
  encryptedReqRecord.writeUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  encryptedReqRecord.writeUint16(encryptedReqLength, `${encryptedReqLength} bytes follow`);
  const encReqRecordHeader = encryptedReqRecord.array();
  const encryptedReqData = await applicationEncrypter.process(requestDataRecord.array(), 16, encReqRecordHeader);
  encryptedReqRecord.writeBytes(encryptedReqData);
  encryptedReqRecord.comment('encrypted data');
  console.log(...highlightCommented(encryptedReqRecord.commentedString(), Colours.client));
  ws.send(encryptedReqRecord.array());

  // read
  const encryptedResponse = await readTlsRecord(reader, RecordTypes.Application);
  const decryptedResponse = await applicationDecrypter.process(encryptedResponse.content, 16, encryptedResponse.header.array());
  console.log(new TextDecoder().decode(decryptedResponse));
}

startTls('neon-cf-pg-test.jawj.workers.dev', 443);
// calculateKeysTest();
