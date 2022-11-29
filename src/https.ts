
import { ReadQueue } from './util/readqueue';
import Bytes from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';

const txtDec = new TextDecoder();

export async function https(urlStr: string, method = 'GET') {
  const t0 = Date.now();

  const url = new URL(urlStr);
  if (url.protocol !== 'https:') throw new Error('Wrong protocol');
  const host = url.hostname;
  const port = url.port || 443;  // not `?? 443`, because it's an empty string if unspecified
  const reqPath = url.pathname + url.search;

  // host: string, port: number
  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9876/v1?address=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (err) => { console.log('ws error:', err); });
    ws.addEventListener('close', () => { chatty && log('connection closed'); })
  });
  const reader = new ReadQueue(ws);

  const [read, write] = await startTls(host, reader.read.bind(reader), ws.send.bind(ws));

  const request = new Bytes(1024);
  request.writeUTF8String(`${method} ${reqPath} HTTP/1.0\r\nHost:${host}\r\n\r\n`);
  chatty && log(...highlightBytes(request.commentedString(), LogColours.client));
  write(request.array());

  let responseData;
  let response = '';
  do {
    responseData = await read();
    if (responseData) {
      const responseText = txtDec.decode(responseData);
      response += responseText;
      chatty && log(responseText);
    }
  } while (responseData);

  chatty && log(`time taken: ${Date.now() - t0}ms`);
  return response;
}