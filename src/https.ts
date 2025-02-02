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
import { HPACKStaticTable, HTTP2FrameType, HTTP2SettingsType, HTTP2SettingsTypeNames, readFrame, writeFrame } from './h2';
import { HPACKBytes } from './util/hpackBytes';
import { LazyReadFunctionReadQueue } from './util/readQueue';
import { GrowableData } from './util/array';

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
      chatty && log('Connection closed by remote peer (this message may show up out of order, before the last data has been decrypted and logged)');
    },
    ...socketOptions,
  });

  const rootCerts = await rootCertsPromise;
  const { read, write, end, protocolFromALPN } = await startTls(host, rootCerts, transport.read, transport.write, { protocolsForALPN: protocols });

  let response = '';

  if (protocolFromALPN === 'h2') {
    chatty && log('It’s time for an HTTP/2 GET request. This starts with a fixed 24-byte preface ([RFC 9113 § 3.4](https://datatracker.ietf.org/doc/html/rfc9113#name-http-2-connection-preface)) that’s specifically designed to make HTTP/1.1 servers throw in the towel, plus a mandatory [SETTINGS frame](https://datatracker.ietf.org/doc/html/rfc9113#section-6.5).');
    chatty && log('Then we get on with sending a [HEADERS frame](https://datatracker.ietf.org/doc/html/rfc9113#name-headers), including [pseudo-headers](https://datatracker.ietf.org/doc/html/rfc9113#PseudoHeaderFields) — :scheme, :method, :path and :authority — that specify the request. We don’t wait to hear about the server’s settings first, because we can be pretty sure it will accept our small request over a single stream.');
    chatty && log('These HTTP/2 headers are compressed using HPACK, a compression scheme that involves indexed tables, Huffman encoding, and various kinds of bit-twiddling. It’s complex enough to get its own RFC, [RFC 7542](https://datatracker.ietf.org/doc/html/rfc7541).');

    const request = new HPACKBytes();
    request.writeUTF8String('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
    chatty && request.comment('— the connection preface');

    const endSettingsFrame = writeFrame(request, HTTP2FrameType.SETTINGS, 0x0);
    request.writeUint16(0x0002, chatty && 'setting: SETTINGS_ENABLE_PUSH');
    request.writeUint32(0x00000000, chatty && 'value: disabled (we just want to fetch this page, thanks)');
    endSettingsFrame();

    const endHeadersFrame = writeFrame(request, HTTP2FrameType.HEADERS, 0x1, 0x04 | 0x01, '= END_HEADERS (0x04) | END_STREAM (0x01)');

    request.writeHPACKInt(7, 1, 1);
    chatty && request.comment('= [indexed field](https://datatracker.ietf.org/doc/html/rfc7541#section-6.1), ":scheme: https"');

    request.writeHPACKInt(2, 1, 1);
    chatty && request.comment('= indexed field, ":method: GET"');

    if (reqPath === '/') {
      request.writeHPACKInt(4, 1, 1);
      chatty && request.comment('= indexed field, ":path: /"');

    } else {
      request.writeHPACKInt(4, 4, 0);
      chatty && request.comment('= indexed field name / [field not added to index](https://datatracker.ietf.org/doc/html/rfc7541#section-6.2.2), ":path:"');
      request.writeHPACKString(reqPath);
    }

    request.writeHPACKInt(1, 2, 1);
    chatty && request.comment('= indexed field name / [field added to index](https://datatracker.ietf.org/doc/html/rfc7541#section-6.2.1), ":authority:"');
    request.writeHPACKString(host);

    endHeadersFrame();

    chatty && log(...highlightBytes(request.commentedString(), LogColours.client));

    chatty && log('Which goes to the server encrypted like so:');
    await write(request.array());

    chatty && log('The server replies:');

    const readQueue = new LazyReadFunctionReadQueue(read);
    const readFn = readQueue.read.bind(readQueue);
    const body = new GrowableData();

    let flagEndStream = false;
    while (!flagEndStream) {
      const response = new HPACKBytes(readFn);
      const { payloadEnd, payloadRemaining, frameType, flags, streamId } = await readFrame(response);
      let ackFrame;

      switch (frameType) {
        case HTTP2FrameType.SETTINGS: {
          if (streamId !== 0) throw new Error('Illegal SETTINGS with non-zero stream ID');

          const ack = Boolean(flags & 0x01);
          if (ack) {
            chatty && log('And the server acknowledges our earlier SETTINGS frame:');
            response.comment('= ACK client settings', response.offset - 4);
            if (payloadRemaining() > 0) throw new Error('Illegal non-zero-length SETTINGS ACK');
            break;
          }

          if (payloadRemaining() % 6 !== 0) throw new Error('Illegal SETTINGS payload length');
          while (payloadRemaining() > 0) {
            const settingsType = await response.readUint16() as HTTP2SettingsType;
            chatty && response.comment(`setting: ${HTTP2SettingsTypeNames[settingsType] ?? 'unrecognised ([GREASE](https://datatracker.ietf.org/doc/html/draft-bishop-httpbis-grease-01)?)'}`);
            const settingsValue = await response.readUint32();
            chatty && response.comment(`value: ${settingsValue}`);
          }

          chatty && log('This is the required initial SETTINGS frame from the server, which we immediately acknowledge:');
          ackFrame = new HPACKBytes();
          writeFrame(ackFrame, HTTP2FrameType.SETTINGS, 0x0, 0x01, chatty && '= ACK server settings');
          break;
        }

        case HTTP2FrameType.WINDOW_UPDATE: {
          chatty && log('Now we get a [WINDOW_UPDATE frame](https://datatracker.ietf.org/doc/html/rfc9113#name-window_update):');
          const winSizeInc = await response.readUint32();
          chatty && response.comment(`window size increment: ${winSizeInc} bytes`);
          break;
        }

        case HTTP2FrameType.HEADERS:
        case HTTP2FrameType.CONTINUATION:
        case HTTP2FrameType.DATA: {

          const flagPriority = Boolean(flags & 0x32);
          const flagPadded = Boolean(flags & 0x08);
          const flagEndHeaders = Boolean(flags & 0x04);
          flagEndStream = Boolean(flags & 0x01);

          if (chatty) {
            const flagNames = [];
            if (flagPriority) flagNames.push('PRIORITY');
            if (flagPadded) flagNames.push('PADDED');
            if (flagEndHeaders) flagNames.push('END_HEADERS');
            if (flagEndStream) flagNames.push('END_STREAM');
            response.comment(`= ${flagNames.join(' | ')}`, response.offset - 4);
          }

          let paddingBytes = 0;
          if (flagPadded) {
            paddingBytes = await response.readUint8('padding length');
          }
          if (flagPriority) {
            await response.readUint32('exclusive, stream dependency');
            await response.readUint8('weight');
          }

          if (frameType === HTTP2FrameType.HEADERS || frameType === HTTP2FrameType.CONTINUATION) {
            chatty && log('The server sends us its response HEADERS:');

            while (payloadRemaining() > paddingBytes) {
              const byte = await response.readUint8();
              response.offset--;

              if (byte & 0x80) {  // Indexed Header Field Representation: https://datatracker.ietf.org/doc/html/rfc7541#section-6.1
                const { i: tableIndex } = await response.readHPACKInt(1);
                if (tableIndex === 0) throw new Error('Illegal zero index for header');

                const [kStatic, vStatic] = HPACKStaticTable[tableIndex]!;
                chatty && response.comment(`= indexed field, "${kStatic}: ${vStatic}"`);

              } else {
                const indexed = byte & 0x40;
                const { i: tableIndex, leftBitValue } = await response.readHPACKInt(indexed ? 2 : 4);
                let k;
                if (tableIndex === 0) {
                  chatty && response.comment(`= literal field / ${indexed ? '' : leftBitValue === 1 ? 'never ' : 'not '}added to index`);
                  k = await response.readHPACKString();
                } else {
                  k = HPACKStaticTable[tableIndex]![0];
                  chatty && response.comment(`= indexed field name / field ${indexed ? '' : leftBitValue === 1 ? 'never ' : 'not '}added to index, "${k}:"`);
                }
                await response.readHPACKString();
              }
            }

          } else {  // i.e. DATA
            chatty && log('And finally we receive the response body as one or more [DATA frames](https://datatracker.ietf.org/doc/html/rfc9113#name-data). You’ll see it first encrypted, then as a parsed HTTP/2 frame, and finally decoded as UTF-8 text.');
            body.append(await response.readBytes(payloadRemaining() - paddingBytes));
            chatty && response.comment('data');

          }
          if (paddingBytes > 0) await response.skipRead(paddingBytes, 'padding (should be zeroes)');
          break;
        }

        default: {
          await response.readBytes(payloadRemaining());
          chatty && response.comment('payload for unhandled frame type');
        }
      }
      payloadEnd();

      chatty && log(...highlightBytes(response.commentedString(), LogColours.server));
      if (frameType === HTTP2FrameType.DATA) chatty && log(txtDec.decode(body.getData()));

      if (ackFrame) {
        chatty && log(...highlightBytes(ackFrame.commentedString(), LogColours.client));
        await write(ackFrame.array());
      }
    }

    // chatty && log('All that remains is for each side to tell the other to GOAWAY:');

    // const clientGoAway = new Bytes();
    // const clientGoAwayEnd = writeFrame(clientGoAway, HTTP2FrameType.GOAWAY, 0x00);
    // clientGoAway.writeUint32(0x01, chatty && 'Last-Stream-Id');
    // clientGoAway.writeUint32(0x00, chatty && 'NO_ERROR');
    // clientGoAwayEnd();
    // chatty && log(...highlightBytes(clientGoAway.commentedString(), LogColours.client));
    // await write(clientGoAway.array());

    // const serverGoAway = new Bytes(readFn);
    // const { payloadRemaining } = await readFrame(serverGoAway);
    // await serverGoAway.readUint32(chatty && 'Last-Stream-ID');
    // await serverGoAway.expectUint32(0x00, chatty && 'NO_ERROR');
    // if (payloadRemaining()) await serverGoAway.readUTF8String(payloadRemaining());

    // chatty && log(...highlightBytes(serverGoAway.commentedString(), LogColours.server));

    chatty && log('Mission accomplished. At this point, we could send the server an HTTP/2 [GOAWAY frame](https://datatracker.ietf.org/doc/html/rfc9113#name-goaway), but most servers seem not to do anything in response. We could also just unceremoniously close the underlying WebSocket/TCP connection.');
    chatty && log('What we actually do is something in-between: we send a TLS close-notify Alert record, which will generally cause the server to hang up. Unencrypted, that’s three bytes: 0x01 (Alert type: warning), 0x00 (warning type: close notify), 0x15 (TLS record type: Alert).');

    await end();

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
