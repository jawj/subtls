
import highlightCommented from './util/highlightCommented';
import makeClientHello from './clientHello';
import { ReadQueue } from './util/readqueue';
import { readTlsRecord, RecordTypeNames, RecordTypes } from './util/tlsrecord';
import Bytes from './util/bytes';
import parseServerHello from './parseServerHello';
import { calculateKeysTest } from './keyscalc';

const clientColour = '#aca';
const serverColour = '#aac';

async function startTls(host: string, port: number) {
  // TODO: parallel waiting
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true /* extractable */, ['deriveKey', 'deriveBits']);
  const rawPublicKey = await crypto.subtle.exportKey('raw', keys.publicKey);

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

  // keys calculation
  const serverPublicKey = await crypto.subtle.importKey('raw', serverRawPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false /* extractable */, []);
  const sharedSecretBuffer = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, keys.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  console.log('shared secret', sharedSecret);

  // SHA384 of client + server hellos
  const clientHelloContent = clientHelloData.subarray(5);  // cut off the 5-byte record header
  const serverHelloContent = serverHelloRecord.content;  // 5-byte record header is already excluded
  const combinedContent = new Uint8Array(clientHelloContent.length + serverHelloContent.length);
  combinedContent.set(clientHelloContent);
  combinedContent.set(serverHelloContent, clientHelloContent.length);
  const hellosHashBuffer = await crypto.subtle.digest('SHA-384', combinedContent);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  console.log('hash', hellosHash);

  // encrypted portion ...
  const record = await readTlsRecord(reader, RecordTypes.Application);
  console.log(RecordTypeNames[record.type], record);
}

// startTls('cloudflare.com', 443);
calculateKeysTest();
