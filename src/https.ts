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
// @ts-ignore
import digicertroot from './roots/digicert-global-root.pem';

const txtDec = new TextDecoder();

export async function https(urlStr: string, method: string, transportFactory: typeof wsTransport) {
  const t0 = Date.now();

  const url = new URL(urlStr);
  if (url.protocol !== 'https:') throw new Error('Wrong protocol');
  const host = url.hostname;
  const port = url.port || 443;  // not `?? 443`, because it's an empty string if unspecified
  const reqPath = url.pathname + url.search;

  chatty && log('We begin the TLS handshake by sending a client hello message ([source](https://github.com/jawj/subtls/blob/main/src/tls/makeClientHello.ts)):');

  const rootCert = TrustedCert.fromPEM(isrgrootx1 + isrgrootx2 + baltimoreroot + digicertroot);

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
