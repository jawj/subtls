import { Bytes } from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes, mutedColour, textColour } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';
import type wsTransport from './util/wsTransport';
import type tcpTransport from './util/tcpTransport';
import { getRootCertsDatabase } from './util/rootCerts';
import { SocketOptions } from './util/tcpTransport';
import { WebSocketOptions } from './util/wsTransport';
import { HTTP2FrameType, writeFrame } from './h2';

const txtDec = new TextDecoder();

export interface HTTPSOptions {
  headers?: Record<string, string>;
  protocols?: string[];
  socketOptions?: SocketOptions | WebSocketOptions;
}

export async function https(
  urlStr: string,
  method: string,
  transportFactory: typeof wsTransport | typeof tcpTransport,
  rootCertsPromise: ReturnType<typeof getRootCertsDatabase>,
  {
    headers = {},
    protocols = ['h2', 'http/1.1'],
    socketOptions = {},
  }: HTTPSOptions = {}
) {
  const url = new URL(urlStr);
  if (url.protocol !== 'https:') throw new Error('Wrong protocol');

  const host = url.hostname;
  const port = url.port || 443;  // not `?? 443`, because it's an empty string if unspecified
  const reqPath = url.pathname + url.search;

  const transport = await transportFactory(host, port, {
    close: () => {
      chatty && log('Connection closed (this message may appear out of order, before the last data has been decrypted and logged)');
    },
    ...socketOptions,
  });

  const rootCerts = await rootCertsPromise;
  const { read, write, protocolFromALPN } = await startTls(host, rootCerts, transport.read, transport.write, { protocolsForALPN: protocols });

  let response = '';

  if (protocolFromALPN === 'h2') {
    chatty && log('Here’s an HTTP/2 GET request:');

    const request = new Bytes();
    request.writeUTF8String('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
    chatty && request.comment('— the connection preface ([RFC 9113 § 3.4](https://datatracker.ietf.org/doc/html/rfc9113#name-http-2-connection-preface))');

    const endSettingsFrame = writeFrame(request, HTTP2FrameType.SETTINGS, 0x0);
    request.writeUint16(0x0002, chatty && 'setting: SETTINGS_ENABLE_PUSH');
    request.writeUint32(0x00000000, chatty && 'value: disabled');
    endSettingsFrame();

    const endHeadersFrame = writeFrame(request, HTTP2FrameType.HEADERS, 0x1, 0x04 /* END_HEADERS */ | 0x01 /* END_STREAM */);
    request.writeUint8(0x82, chatty && ':method: GET');
    request.writeUint8(0x87, chatty && ':scheme: https');
    request.writeUint8(0x84, chatty && ':path: /');
    request.writeUint8(0x41, chatty && ':authority');
    const endAuthority = request.writeLengthUint8('authority');
    request.writeUTF8String(host);
    endAuthority();
    endHeadersFrame();

    const goAwayFrame = writeFrame(request, HTTP2FrameType.GOAWAY, 0x0);
    request.writeUint32(0x01, 'Last-Stream-Id');
    request.writeUint32(0x0, 'NO_ERROR');
    goAwayFrame();

    chatty && log(...highlightBytes(request.commentedString(), LogColours.client));

    chatty && log('Which goes to the server encrypted like so:');
    await write(request.array());

    chatty && log('The server replies:');
    let responseData;

    do {
      responseData = await read();
      if (responseData) {
        const responseText = txtDec.decode(responseData);
        response += responseText;
        chatty && log(responseData, responseText);
      }
    } while (responseData);


  } else {
    headers['Host'] ??= host;

    chatty && log('Here’s a GET request:');
    const request = new Bytes();
    request.writeUTF8String(`${method} ${reqPath} HTTP/1.0\r\n`);  // for ALPN, http/1.0 is not recognised by IIS  https://github.com/curl/curl/issues/12259
    for (const header in headers) request.writeUTF8String(`${header}: ${headers[header]}\r\n`);
    request.writeUTF8String('\r\n');
    chatty && log(...highlightBytes(request.commentedString(), LogColours.client));
    chatty && log('Which goes to the server encrypted like so:');
    await write(request.array());

    chatty && log('The server replies:');
    let responseData;

    do {
      responseData = await read();
      if (responseData) {
        const responseText = txtDec.decode(responseData);
        response += responseText;
        chatty && log(responseText);
      }
    } while (responseData);
  }

  chatty && log(
    `Total bytes: %c${transport.stats.written}%c sent, %c${transport.stats.read}%c received`,
    textColour, mutedColour, textColour, mutedColour
  );

  return response;
}
