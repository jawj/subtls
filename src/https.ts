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
    chatty && log('Here’s an HTTP/2 GET request. It starts with a fixed 24-byte preface, which is designed to make HTTP/1.1 servers give up, plus a mandatory SETTINGS frame. And then we get right on with sending the HEADERS, which also specify our GET request:');

    const request = new HPACKBytes();
    request.writeUTF8String('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
    chatty && request.comment('— the connection preface ([RFC 9113 § 3.4](https://datatracker.ietf.org/doc/html/rfc9113#name-http-2-connection-preface))');

    const endSettingsFrame = writeFrame(request, HTTP2FrameType.SETTINGS, 0x0);
    request.writeUint16(0x0002, chatty && 'setting: SETTINGS_ENABLE_PUSH');
    request.writeUint32(0x00000000, chatty && 'value: disabled');
    endSettingsFrame();

    const endHeadersFrame = writeFrame(request, HTTP2FrameType.HEADERS, 0x1, 0x04 | 0x01, 'END_HEADERS (0x04) | END_STREAM (0x01)');

    request.writeHPACKInt(7, 1, 1);
    chatty && request.comment('= indexed field, ":scheme: https"');

    request.writeHPACKInt(2, 1, 1);
    chatty && request.comment('= indexed field, ":method: GET"');

    if (reqPath === '/') {
      request.writeHPACKInt(4, 1, 1);
      chatty && request.comment('= indexed field, ":path: /"');

    } else {
      request.writeHPACKInt(4, 4, 0);
      chatty && request.comment('= indexed field name / field not added to index, ":path:"');
      request.writeHPACKString(reqPath);
    }

    request.writeHPACKInt(1, 2, 1);
    chatty && request.comment('= indexed field name / field added to index, ":authority:"');
    request.writeHPACKString(host);

    endHeadersFrame();

    // const goAwayFrame = writeFrame(request, HTTP2FrameType.GOAWAY, 0x0);
    // request.writeUint32(0x01, 'Last-Stream-Id');
    // request.writeUint32(0x0, 'NO_ERROR');
    // goAwayFrame();

    chatty && log(...highlightBytes(request.commentedString(), LogColours.client));

    chatty && log('Which goes to the server encrypted like so:');
    await write(request.array());

    chatty && log('The server replies:');

    const readQueue = new LazyReadFunctionReadQueue(read);
    const readFn = readQueue.read.bind(readQueue);

    let flagEndStream = false;
    while (!flagEndStream) {
      const response = new HPACKBytes(readFn);
      const { payloadEnd, payloadRemaining, frameType, flags, streamId } = await readFrame(response);
      let ackFrame;

      switch (frameType) {
        case HTTP2FrameType.SETTINGS: {
          if (streamId !== 0) throw new Error('Illegal SETTINGS for non-zero stream ID');
          const ack = Boolean(flags & 0x01);
          if (ack) {
            chatty && log('The server now acknowledges our earlier SETTINGS frame:');
            response.comment('ACK client settings', response.offset - 4);
            if (payloadRemaining() > 0) throw new Error('Illegal non-zero-length SETTINGS ACK');
            break;
          }
          if (payloadRemaining() % 6 !== 0) throw new Error('Illegal SETTINGS payload length');
          while (payloadRemaining() > 0) {
            const settingsType = await response.readUint16() as HTTP2SettingsType;
            chatty && response.comment(`setting: ${HTTP2SettingsTypeNames[settingsType] ?? 'unknown setting'}`);
            const settingsValue = await response.readUint32();
            chatty && response.comment(`value: ${settingsValue}`);
          }

          chatty && log('This is a SETTINGS frame from the server, which we’ll immediately acknowledge:');
          ackFrame = new HPACKBytes();
          writeFrame(ackFrame, HTTP2FrameType.SETTINGS, 0x0, 0x01, chatty && 'ACK server settings');
          break;
        }

        case HTTP2FrameType.WINDOW_UPDATE: {
          const winSizeInc = await response.readUint32();
          chatty && response.comment(`window size increment: ${winSizeInc} bytes`);
          break;
        }

        case HTTP2FrameType.HEADERS:
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

          if (frameType === HTTP2FrameType.HEADERS) {
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

          } else {
            await response.skipRead(payloadRemaining() - paddingBytes, 'data');
          }
          if (paddingBytes > 0) await response.skipRead(paddingBytes, 'padding (should be zeroes)');
          break;
        }

        default: {
          await response.readUTF8String(payloadRemaining());
          chatty && response.comment('payload');
        }
      }
      payloadEnd();
      chatty && log(...highlightBytes(response.commentedString(), LogColours.server));

      if (ackFrame) {
        chatty && log(...highlightBytes(ackFrame.commentedString(), LogColours.client));
        await write(ackFrame.array());
      }
    }

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
