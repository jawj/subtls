
import highlightCommented from './util/highlightCommented';
import clientHello from './clientHello';
import { ReadQueue } from './util/readqueue';
import { readTlsRecord, RecordTypeNames, RecordTypes } from './util/tlsrecord';
import Bytes from './util/bytes';

const clientColour = '#aca';
const serverColour = '#aac';

async function startTls(host: string, port: number) {
  // TODO: parallel waiting
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true /* extractable */, ['deriveKey', 'deriveBits']);
  const publicKey = await crypto.subtle.exportKey('raw', keys.publicKey);

  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
  });

  const reader = new ReadQueue(ws);

  const hello = clientHello(host, publicKey);
  console.log(...highlightCommented(hello.commentedString(), clientColour));
  ws.send(hello.array());

  const shellodata = await readTlsRecord(reader, RecordTypes.Handshake);
  const shello = new Bytes(shellodata.content);

  shello.expectUint8(0x02, 'handshake type: server hello');
  const helloLength = shello.readUint24('server hello length');

  shello.expectUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  const serverRandom = shello.slice(32);
  shello.comment('server random');

  shello.expectUint8(0x20, 'session ID length');
  shello.skip(0x20, 'session ID (should match client hello)');

  shello.expectUint16(0x1301, 'cipher (matches client hello)');
  shello.expectUint8(0x00, 'no compression');

  const extensionsLength = shello.readUint16('extensions length');

  while (shello.remainingBytes() > 0) {
    const extensionType = shello.readUint16('extension type');
    const extensionLength = shello.readUint16('extension length');

    if (extensionType === 0x002b) {
      if (extensionLength !== 2) throw new Error(`Unexpected extension length: ${extensionLength} (expected 2)`);
      shello.expectUint16(0x0304, 'TLS version 1.3');

    } else if (extensionType === 0x0033) {
      shello.expectUint16(0x0017, 'secp256r1 (NIST P-256) key share');
      shello.expectUint16(65);
      const serverPublicKey = shello.slice(65);
      shello.comment('key');

    } else {
      throw new Error(`Unexpected extension 0x${extensionType.toString(16).padStart(4, '0')}, length ${extensionLength}`)
    }
  }

  if (shello.remainingBytes() !== 0) throw new Error(`Unexpected additional data at end of server hello`);
  console.log(...highlightCommented(shellodata.header.commentedString() + shello.commentedString(), serverColour));

  const changeCipherRecord = await readTlsRecord(reader, RecordTypes.ChangeCipherSpec);
  const ccipher = new Bytes(changeCipherRecord.content);
  ccipher.expectUint8(0x01, 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  if (ccipher.remainingBytes() !== 0) throw new Error(`Unexpected additional data at end of ChangeCipherSpec`);
  console.log(...highlightCommented(changeCipherRecord.header.commentedString() + ccipher.commentedString(), serverColour));

  const record = await readTlsRecord(reader, RecordTypes.Application);
  console.log(RecordTypeNames[record.type], record);
}

startTls('cloudflare.com', 443);
