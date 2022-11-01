
import highlightCommented from './util/highlightCommented';
import clientHello from './clientHello';

async function startTls(host: string, port: number) {

  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true /* extractable */, ['deriveKey', 'deriveBits']);
  const publicKey = await crypto.subtle.exportKey('raw', keys.publicKey);

  const hello = clientHello(host, publicKey);

  console.log(...highlightCommented(hello.commentedString(), '#aaa'));

  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('message', msg => console.log(new Uint8Array(msg.data)));
  });

  const bytes = hello.array();
  console.log(bytes);
  ws.send(bytes);
}

startTls('google.com', 443);
