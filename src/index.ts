
import highlightCommented from './util/highlightCommented';
import makeClientHello from './clientHello';
import { ReadQueue } from './util/readqueue';
import { readEncryptedTlsRecord, readTlsRecord, RecordType, unwrapDecryptedTlsRecord } from './util/tlsrecord';
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
  const serverHelloRecord = await readTlsRecord(reader, RecordType.Handshake);
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverPublicKey = parseServerHello(serverHello, sessionId);
  console.log(...highlightCommented(serverHelloRecord.header.commentedString() + serverHello.commentedString(), Colours.server));

  // dummy cipher change
  const changeCipherRecord = await readTlsRecord(reader, RecordType.ChangeCipherSpec);
  const ccipher = new Bytes(changeCipherRecord.content);
  ccipher.expectUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  if (ccipher.remainingBytes() !== 0) throw new Error(`Unexpected additional data at end of ChangeCipherSpec`);
  console.log(...highlightCommented(changeCipherRecord.header.commentedString() + ccipher.commentedString(), Colours.server));

  console.log('%c%s', `color: ${Colours.header}`, 'handshake key computations');

  // keys
  const clientHelloContent = clientHelloData.subarray(5);  // cut off the 5-byte record header
  const serverHelloContent = serverHelloRecord.content;    // 5-byte record header is already excluded
  const hellos = concat(clientHelloContent, serverHelloContent);  // we could slightly improve efficiency with Cloudflare's DigestStream by avoiding a concat
  const handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16);  // would be 384, 32 for AES256_SHA384
  const serverHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.serverHandshakeKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const handshakeDecrypter = new Crypter('decrypt', serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.clientHandshakeKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const handshakeEncrypter = new Crypter('encrypt', clientHandshakeKey, handshakeKeys.clientHandshakeIV);

  // encrypted part of server handshake
  const serverHandshake = await readEncryptedTlsRecord(reader, handshakeDecrypter, RecordType.Handshake);
  await parseEncryptedHandshake(host, serverHandshake);

  // dummy cipher change
  const clientCipherChange = new Bytes(6);
  clientCipherChange.writeUint8(0x14, 'record type: ChangeCipherSpec');
  clientCipherChange.writeUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  clientCipherChange.writeUint16(0x0001, 'payload length: 1 byte');
  clientCipherChange.writeUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  console.log(...highlightCommented(clientCipherChange.commentedString(), Colours.client));
  const clientCipherChangeData = clientCipherChange.array();
  ws.send(clientCipherChangeData);

  // hash of whole handshake (cipher change excluded)
  const wholeHandshake = concat(hellos, serverHandshake);
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
  clientFinishedRecord.writeUint8(RecordType.Handshake, 'record type: Handshake');
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
  requestDataRecord.writeUint8(RecordType.Application, 'record type: Application');
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
  const serverResponse = await readEncryptedTlsRecord(reader, applicationDecrypter, RecordType.Application);
  console.log(new TextDecoder().decode(serverResponse));
}

startTls('neon-cf-pg-test.jawj.workers.dev', 443);
// calculateKeysTest();
