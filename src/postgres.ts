
import { ReadQueue } from './util/readqueue';
import Bytes from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';
import { uint8FromUint32 } from './util/bigEndian';
import { hexFromU8 } from './util/hex';
import { equal } from './util/array';

const txtDec = new TextDecoder();

export async function postgres(urlStr: string) {
  const t0 = Date.now();

  const url = parse(urlStr);
  const host = url.hostname;
  const port = url.port || 5432;  // not `?? 5432`, because it's an empty string if unspecified
  const user = url.username;
  const password = `project=${host.match(/^[^.]+/)![0]};${url.password}`;
  const db = url.pathname.slice(1);

  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9876/v1?address=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (err) => { console.log('ws error:', err); });
    ws.addEventListener('close', () => { chatty && log('connection closed'); })
  });
  const reader = new ReadQueue(ws);
  const networkRead = reader.read.bind(reader);
  const networkWrite = ws.send.bind(ws);

  const sslRequest = new Bytes(8);
  const endSslRequest = sslRequest.writeLengthUint32Incl('ssl request');
  sslRequest.writeUint32(0x04d2162f);
  endSslRequest();
  chatty && log(...highlightBytes(sslRequest.commentedString(), LogColours.client));
  const writePreData = sslRequest.array();

  const sslResponse = new Bytes(1);
  sslResponse.writeUTF8String('S');
  const expectPreData = sslResponse.array();
  console.log('expectPreData', expectPreData, expectPreData.length);

  const [read, write] = await startTls(host, networkRead, networkWrite, false, writePreData, expectPreData);

  const msg = new Bytes(1024);

  const endStartupMessage = msg.writeLengthUint32Incl('startup message');
  msg.writeUint32(0x0003_0000, 'protocol version');
  msg.writeUTF8String('user');
  msg.writeUint8(0x00, 'end of string');
  msg.writeUTF8String(user);
  msg.writeUint8(0x00, 'end of string');
  msg.writeUTF8String('database');
  msg.writeUint8(0x00, 'end of string');
  msg.writeUTF8String(db);
  msg.writeUint8(0x00, 'end of string');
  msg.writeUint8(0x00, 'end of message');
  endStartupMessage();

  msg.writeUTF8String('p');
  msg.comment('= password');
  const endPasswordMessage = msg.writeLengthUint32Incl('password message');
  msg.writeUTF8String(password);
  msg.writeUint8(0x00, 'end of string');
  endPasswordMessage();

  chatty && log(...highlightBytes(msg.commentedString(), LogColours.client));
  write(msg.array());

  const preAuthResponse = await read();
  const preAuthBytes = new Bytes(preAuthResponse!);

  preAuthBytes.expectUint8('R'.charCodeAt(0), '"R" = authentication request');
  const [endAuthReq] = preAuthBytes.expectLengthUint32Incl('request');
  preAuthBytes.expectUint32(3, 'request cleartext password auth');
  endAuthReq();
  chatty && log(...highlightBytes(preAuthBytes.commentedString(true), LogColours.client));

  const postAuthResponse = await read();
  const postAuthBytes = new Bytes(postAuthResponse!);
  postAuthBytes.expectUint8('R'.charCodeAt(0), '"R" = authentication request');
  const [endAuthOK] = postAuthBytes.expectLengthUint32Incl('result');
  postAuthBytes.expectUint32(0, 'authentication successful');
  endAuthOK();

  while (postAuthBytes.remaining() > 0) {
    const msgType = postAuthBytes.readUTF8String(1);
    if (msgType === 'S') {
      postAuthBytes.comment('= parameter status');
      const [endParams, paramsRemaining] = postAuthBytes.expectLengthUint32Incl('run-time parameters');
      while (paramsRemaining() > 0) {
        const k = postAuthBytes.readUTF8StringNullTerminated();
        const v = postAuthBytes.readUTF8StringNullTerminated();
      }
      endParams();

    } else if (msgType === 'K') {
      postAuthBytes.comment('= back-end key data');
      const [endKeyData] = postAuthBytes.expectLengthUint32Incl();
      postAuthBytes.readUint32('backend process ID');
      postAuthBytes.readUint32('backend secret key');
      endKeyData();

    } else if (msgType === 'Z') {
      postAuthBytes.comment('= ready for query');
      const [endStatus] = postAuthBytes.expectLengthUint32Incl('status');
      postAuthBytes.expectUint8('I'.charCodeAt(0), '"I" = idle');
      endStatus();
    }
  }
  chatty && log(...highlightBytes(postAuthBytes.commentedString(true), LogColours.client));

  let responseData;
  do {
    responseData = await read();
    if (responseData) {
      chatty && log(hexFromU8(responseData, ' '));
    }
  } while (responseData);

  chatty && log(`time taken: ${Date.now() - t0}ms`);
}

function parse(url: string, parseQueryString = false) {
  const { protocol } = new URL(url);
  // we now swap the protocol to http: so that `new URL()` will parse it fully
  const httpUrl = 'http:' + url.substring(protocol.length);
  let { username, password, hostname, port, pathname, search, searchParams, hash } = new URL(httpUrl);
  password = decodeURIComponent(password);
  const auth = username + ':' + password;
  const query = parseQueryString ? Object.fromEntries(searchParams.entries()) : search;
  return { href: url, protocol, auth, username, password, hostname, port, pathname, search, query, hash };
}