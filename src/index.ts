
import highlightCommented from './util/highlightCommented';
import makeClientHello from './clientHello';
import { ReadQueue } from './util/readqueue';
import { readTlsRecord, RecordTypeNames, RecordTypes } from './util/tlsrecord';
import Bytes from './util/bytes';
import parseServerHello from './parseServerHello';
import { getHandshakeKeys, getHandshakeKeysTest } from './keyscalc';
import { hexFromU8 } from './util/hex';
import { Decrypter } from './aesgcm';

const clientColour = '#8c8';
const serverColour = '#88c';
const headerColor = '#c88';

async function startTls(host: string, port: number) {
  // TODO: parallel waiting
  const ecdhKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true /* extractable */, ['deriveKey', 'deriveBits']);
  const rawPublicKey = await crypto.subtle.exportKey('raw', ecdhKeys.publicKey);

  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
  });

  const reader = new ReadQueue(ws);

  // client hello
  const clientHello = makeClientHello(host, rawPublicKey);
  console.log(...highlightCommented(clientHello.commentedString(), clientColour));
  const clientHelloData = clientHello.array();
  ws.send(clientHelloData);

  // server hello
  const serverHelloRecord = await readTlsRecord(reader, RecordTypes.Handshake);
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverRawPublicKey = parseServerHello(serverHello);
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
  const combinedContent = new Uint8Array(clientHelloContent.length + serverHelloContent.length);
  combinedContent.set(clientHelloContent);
  combinedContent.set(serverHelloContent, clientHelloContent.length);
  const hellosHashBuffer = await crypto.subtle.digest('SHA-256', combinedContent);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  console.log('hellos hash', hexFromU8(hellosHash));

  // keys
  const handshakeKeys = await getHandshakeKeys(sharedSecret, hellosHash, 256, 16);

  const serverHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.serverHandshakeKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const handshakeDecrypter = new Decrypter(serverHandshakeKey, handshakeKeys.serverHandshakeIV);

  // encrypted portion ...
  const encrypted = await readTlsRecord(reader, RecordTypes.Application);
  console.log(...highlightCommented(encrypted.header.commentedString(), serverColour));
  console.log('%s%c  %s', hexFromU8(encrypted.content), `color: ${serverColour}`, 'encrypted payload + auth tag');

  const decrypted = await handshakeDecrypter.decrypt(encrypted.content, 16, encrypted.headerData);
  console.log('%s%c  %s', hexFromU8(decrypted), `color: ${serverColour}`, 'decrypted payload');


}

startTls('google.com', 443);
// calculateKeysTest();
