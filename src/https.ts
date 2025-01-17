import { Bytes } from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes, mutedColour, textColour } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';
import type wsTransport from './util/wsTransport';
import { getRootCertsDatabase } from './util/rootCerts';

const txtDec = new TextDecoder();

export async function https(urlStr: string, method: string, transportFactory: typeof wsTransport) {
  const t0 = Date.now();

  const url = new URL(urlStr);
  if (url.protocol !== 'https:') throw new Error('Wrong protocol');
  const host = url.hostname;
  const port = url.port || 443;  // not `?? 443`, because it's an empty string if unspecified
  const reqPath = url.pathname + url.search;

  const transport = await transportFactory(host, port, () => {
    chatty && log('Connection closed (this message may appear out of order, before the last data has been decrypted and logged)');
  });

  const rootCerts = await getRootCertsDatabase();
  const { read, write } = await startTls(host, rootCerts, transport.read, transport.write);

  chatty && log('Here’s a GET request:');
  const request = new Bytes();
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

  chatty || log(`time taken: ${Date.now() - t0}ms`);  // don't show this in chatty mode since almost all time is spent logging
  chatty && log(
    `Total bytes: %c${transport.stats.written}%c sent, %c${transport.stats.read}%c received`,
    textColour, mutedColour, textColour, mutedColour
  );

  return response;
}
