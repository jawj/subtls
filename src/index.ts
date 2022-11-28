
import { ReadQueue } from './util/readqueue';
import Bytes from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';

async function start(host: string, port: number) {
  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9876/v1?address=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (err) => { console.log('ws error:', err); });
    ws.addEventListener('close', () => { chatty && log('connection closed'); })
  });
  const reader = new ReadQueue(ws);

  const t0 = Date.now();
  const [read, write] = await startTls(host, reader.read.bind(reader), ws.send.bind(ws));

  // web request
  const request = new Bytes(1024);
  request.writeUTF8String(`HEAD / HTTP/1.0\r\nHost:${host}\r\n\r\n`);
  chatty && log(...highlightBytes(request.commentedString(), LogColours.client));
  write(request.array());

  let serverResponse;
  do {
    serverResponse = await read();
    if (serverResponse) log(new TextDecoder().decode(serverResponse));
  } while (serverResponse);

  log(`time taken: ${Date.now() - t0}ms`);
  window.dispatchEvent(new Event('tlsdone'))
}

// start('neon-cf-pg-test.jawj.workers.dev', 443);
// start('neon-vercel-demo-heritage.vercel.app', 443);  // encrypted handshake is split across multiple messages
// start('developers.cloudflare.com', 443);
start('google.com', 443);
// start('guardian.co.uk', 443);
