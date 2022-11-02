
import highlightCommented from './util/highlightCommented';
import clientHello from './clientHello';
import { ReadQueue } from './util/readqueue';
import { readTlsRecord, RecordTypeNames } from './util/tlsrecord';

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
  console.log(...highlightCommented(hello.commentedString(), '#aaa'));
  ws.send(hello.array());

  const { type, content } = await readTlsRecord(reader);
  console.log(RecordTypeNames[type], content);


}

startTls('google.com', 443);
