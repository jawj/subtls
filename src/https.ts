import { Bytes } from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';
import { getRootCerts } from './tls/rootCerts';
import type wsTransport from './util/wsTransport';

const txtDec = new TextDecoder();

export async function https(urlStr: string, method: string, transportFactory: typeof wsTransport) {
  const t0 = Date.now();

  const url = new URL(urlStr);
  if (url.protocol !== 'https:') throw new Error('Wrong protocol');
  const host = url.hostname;
  const port = url.port || 443;  // not `?? 443`, because it's an empty string if unspecified
  const reqPath = url.pathname + url.search;

  const rootCert = getRootCerts();
  const transport = await transportFactory(host, port, () => {
    chatty && log('Connection closed (this message may appear out of order, before the last data has been decrypted and logged)');
  });
  const [read, write] = await startTls(host, rootCert, transport.read, transport.write);

  chatty && log('Here’s a GET request:');
  const request = new Bytes(1024);
  request.writeUTF8String(`${method} ${reqPath} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
  chatty && log(...highlightBytes(request.commentedString(), LogColours.client));
  chatty && log('Which goes to the server encrypted like so:');
  await write(request.array());

  chatty && log('The server replies:');
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

  chatty || log(`time taken: ${Date.now() - t0}ms`);
  return response;
}
