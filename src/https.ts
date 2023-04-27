import { Bytes } from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';
import { TrustedCert } from './tls/cert';
import type wsTransport from './util/wsTransport';

// @ts-ignore
import isrgrootx1 from './roots/isrg-root-x1.pem';
// @ts-ignore
import isrgrootx2 from './roots/isrg-root-x2.pem';
// @ts-ignore
import baltimoreroot from './roots/baltimore.pem';

const txtDec = new TextDecoder();

export async function https(urlStr: string, method = 'GET', transportFactory: typeof wsTransport) {
  const t0 = Date.now();

  const url = new URL(urlStr);
  if (url.protocol !== 'https:') throw new Error('Wrong protocol');
  const host = url.hostname;
  const port = url.port || 443;  // not `?? 443`, because it's an empty string if unspecified
  const reqPath = url.pathname + url.search;

  chatty && log('We begin the TLS handshake by sending a client hello message:');
  chatty && log('*** Hint: click the handshake log message below to expand. ***');

  const rootCert = TrustedCert.fromPEM(isrgrootx1 + isrgrootx2 + baltimoreroot);

  const transport = await transportFactory(host, port);
  const [read, write] = await startTls(host, rootCert, transport.read, transport.write);

  chatty && log('Here’s a GET request:');
  const request = new Bytes(1024);
  request.writeUTF8String(`${method} ${reqPath} HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
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
