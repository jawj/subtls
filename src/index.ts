
import highlightCommented from './util/highlightCommented';
import makeClientHello from './clientHello';
import { ReadQueue } from './util/readqueue';
import { makeEncryptedTlsRecord, readEncryptedTlsRecord, readTlsRecord, RecordType } from './util/tlsrecord';
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
  const [endCipherPayload] = ccipher.assertByteCount(1);
  ccipher.expectUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  endCipherPayload();
  console.log(...highlightCommented(changeCipherRecord.header.commentedString() + ccipher.commentedString(), Colours.server));

  // keys
  console.log('%c%s', `color: ${Colours.header}`, 'handshake key computations');
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
  await parseEncryptedHandshake(host, serverHandshake, handshakeKeys.serverSecret, hellos);

  // dummy cipher change
  const clientCipherChange = new Bytes(6);
  clientCipherChange.writeUint8(0x14, 'record type: ChangeCipherSpec');
  clientCipherChange.writeUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  const endClientCipherChangePayload = clientCipherChange.writeLengthUint16();
  clientCipherChange.writeUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  endClientCipherChangePayload();
  console.log(...highlightCommented(clientCipherChange.commentedString(), Colours.client));
  const clientCipherChangeData = clientCipherChange.array();
  // ws.send(clientCipherChangeData);  // no: we'll batch this up and send below

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
  const clientFinishedRecordEnd = clientFinishedRecord.writeLengthUint24('handshake finished data');
  clientFinishedRecord.writeBytes(verifyData);
  clientFinishedRecord.comment('verify data');
  clientFinishedRecordEnd();
  clientFinishedRecord.writeUint8(RecordType.Handshake, 'record type: Handshake');
  console.log(...highlightCommented(clientFinishedRecord.commentedString(), Colours.client));

  const encryptedClientFinished = await makeEncryptedTlsRecord(clientFinishedRecord.array(), handshakeEncrypter);
  // ws.send(encryptedClientFinished);  // no: we'll batch this up and send below

  // application keys
  console.log('%c%s', `color: ${Colours.header}`, 'application key computations');
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

  const encryptedRequest = await makeEncryptedTlsRecord(requestDataRecord.array(), applicationEncrypter);
  // ws.send(encryptedRequest);  // no: we'll batch this up and send below

  // write
  ws.send(concat(clientCipherChangeData, encryptedClientFinished, encryptedRequest));

  // read
  while (true) {
    const serverResponse = await readEncryptedTlsRecord(reader, applicationDecrypter, RecordType.Application);
    console.log(new TextDecoder().decode(serverResponse));
  }
}

startTls('neon-cf-pg-test.jawj.workers.dev', 443);
