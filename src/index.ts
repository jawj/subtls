
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
  // console.log(shellodata, shellodata.content);
  const shello = new Bytes(shellodata.content);
  // console.log(shello);

  shello.expectUint8(0x02, 'handshake type: server hello');
  const helloLength = shello.readUint24();
  shello.comment('handshake length');

  shello.expectUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  const serverRandom = shello.slice(32);
  shello.comment('server random');

  shello.expectUint8(0x20, 'session ID length');
  shello.skip(0x20);
  shello.comment('session ID (should match client hello)');

  shello.expectUint16(0x1301, 'cipher (matches client hello)');
  shello.expectUint8(0x00, 'no compression');

  const extensionsLength = shello.readUint16();
  shello.comment('extensions length');

  console.log(...highlightCommented(shello.commentedString(), serverColour));
}

startTls('cloudflare.com', 443);
