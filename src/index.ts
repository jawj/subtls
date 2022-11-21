import makeClientHello from './tls/makeClientHello';
import parseServerHello from './tls/parseServerHello';
import { makeEncryptedTlsRecord, readEncryptedTlsRecord, readTlsRecord, RecordType } from './tls/tlsrecord';
import { getApplicationKeys, getHandshakeKeys, hkdfExpandLabel } from './tls/keys';
import { Crypter } from './tls/aesgcm';
import { parseEncryptedHandshake } from './tls/parseEncryptedHandshake';
import { ReadQueue } from './util/readqueue';
import Bytes from './util/bytes';
import { concat } from './util/array';
import { hexFromU8 } from './util/hex';
import { LogColours } from './presentation/appearance';
import { highlightBytes } from './presentation/highlights';
import { log } from './presentation/log';

async function start(host: string, port: number) {
  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('close', () => { console.log("ws closed"); })
    ws.addEventListener('error', (err) => { console.log("ws error:", err); })
  });
  const reader = new ReadQueue(ws);
  await startTls(host, reader.read.bind(reader), ws.send.bind(ws));
}

async function startTls(host: string, read: (bytes: number) => Promise<Uint8Array>, write: (data: Uint8Array) => void) {
  const ecdhKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true /* extractable */, ['deriveKey', 'deriveBits']);
  const rawPublicKey = await crypto.subtle.exportKey('raw', ecdhKeys.publicKey);

  // client hello
  const sessionId = new Uint8Array(32);
  crypto.getRandomValues(sessionId);
  const clientHello = makeClientHello(host, rawPublicKey, sessionId);
  chatty && log(...highlightBytes(clientHello.commentedString(), LogColours.client));
  const clientHelloData = clientHello.array();

  write(clientHelloData);

  // parse server hello
  const serverHelloRecord = await readTlsRecord(read, RecordType.Handshake);
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverPublicKey = parseServerHello(serverHello, sessionId);
  chatty && log(...highlightBytes(serverHelloRecord.header.commentedString() + serverHello.commentedString(), LogColours.server));

  // parse dummy cipher change
  const changeCipherRecord = await readTlsRecord(read, RecordType.ChangeCipherSpec);
  const ccipher = new Bytes(changeCipherRecord.content);
  const [endCipherPayload] = ccipher.expectLength(1);
  ccipher.expectUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  endCipherPayload();
  chatty && log(...highlightBytes(changeCipherRecord.header.commentedString() + ccipher.commentedString(), LogColours.server));

  // handshake keys, encryption/decryption instances
  chatty && log('%c%s', `color: ${LogColours.header}`, 'handshake key computations');
  const clientHelloContent = clientHelloData.subarray(5);  // cut off the 5-byte record header
  const serverHelloContent = serverHelloRecord.content;    // 5-byte record header is already excluded
  const hellos = concat(clientHelloContent, serverHelloContent);
  const handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16);  // would be 384, 32 for AES256_SHA384
  const serverHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.serverHandshakeKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const handshakeDecrypter = new Crypter('decrypt', serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.clientHandshakeKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const handshakeEncrypter = new Crypter('encrypt', clientHandshakeKey, handshakeKeys.clientHandshakeIV);

  // encrypted part of server handshake
  const serverHandshake = await readEncryptedTlsRecord(read, handshakeDecrypter, RecordType.Handshake);
  await parseEncryptedHandshake(host, serverHandshake, handshakeKeys.serverSecret, hellos);

  // dummy cipher change
  const clientCipherChange = new Bytes(6);
  clientCipherChange.writeUint8(0x14, 'record type: ChangeCipherSpec');
  clientCipherChange.writeUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  const endClientCipherChangePayload = clientCipherChange.writeLengthUint16();
  clientCipherChange.writeUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  endClientCipherChangePayload();
  chatty && log(...highlightBytes(clientCipherChange.commentedString(), LogColours.client));
  const clientCipherChangeData = clientCipherChange.array();  // to be sent below

  // hash of whole handshake (note: dummy cipher change is excluded)
  const wholeHandshake = concat(hellos, serverHandshake);
  const wholeHandshakeHashBuffer = await crypto.subtle.digest('SHA-256', wholeHandshake);
  const wholeHandshakeHash = new Uint8Array(wholeHandshakeHashBuffer);
  chatty && log('whole handshake hash', hexFromU8(wholeHandshakeHash));

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
  chatty && log(...highlightBytes(clientFinishedRecord.commentedString(), LogColours.client));
  const encryptedClientFinished = await makeEncryptedTlsRecord(clientFinishedRecord.array(), handshakeEncrypter);  // to be sent below

  // application keys, encryption/decryption instances
  chatty && log('%c%s', `color: ${LogColours.header}`, 'application key computations');
  const applicationKeys = await getApplicationKeys(handshakeKeys.handshakeSecret, wholeHandshakeHash, 256, 16);
  const clientApplicationKey = await crypto.subtle.importKey('raw', applicationKeys.clientApplicationKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const applicationEncrypter = new Crypter('encrypt', clientApplicationKey, applicationKeys.clientApplicationIV);
  const serverApplicationKey = await crypto.subtle.importKey('raw', applicationKeys.serverApplicationKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const applicationDecrypter = new Crypter('decrypt', serverApplicationKey, applicationKeys.serverApplicationIV);

  // GET request
  const requestDataRecord = new Bytes(1024);
  requestDataRecord.writeUTF8String(`GET / HTTP/1.0\r\nHost:${host}\r\n\r\n`);
  requestDataRecord.writeUint8(RecordType.Application, 'record type: Application');
  chatty && log(...highlightBytes(requestDataRecord.commentedString(), LogColours.client));
  const encryptedRequest = await makeEncryptedTlsRecord(requestDataRecord.array(), applicationEncrypter);  // to be sent below

  write(concat(clientCipherChangeData, encryptedClientFinished, encryptedRequest));


  let done = false;
  while (true) {
    const timeout = setTimeout(() => { if (!done) window.dispatchEvent(new Event('handshakedone')); done = true; }, 1000);
    const serverResponse = await readEncryptedTlsRecord(read, applicationDecrypter, RecordType.Application);
    clearTimeout(timeout);
    chatty && log(new TextDecoder().decode(serverResponse));
  }
}

// start('neon-cf-pg-test.jawj.workers.dev', 443);
// start('neon-vercel-demo-heritage.vercel.app', 443);  // fails: no common cipher?
// start('cloudflare.com', 443);
start('www.google.com', 443);
