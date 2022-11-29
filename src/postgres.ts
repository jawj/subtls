
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
  const endSslRequest = sslRequest.writeLengthUint32Incl(chatty && 'ssl request');
  sslRequest.writeUint32(0x04d2162f);
  endSslRequest();
  chatty && log(...highlightBytes(sslRequest.commentedString(), LogColours.client));
  const writePreData = sslRequest.array();

  const sslResponse = new Bytes(1);
  sslResponse.writeUTF8String('S');
  const expectPreData = sslResponse.array();

  const [read, write] = await startTls(host, networkRead, networkWrite, false, writePreData, expectPreData);

  const msg = new Bytes(1024);

  const endStartupMessage = msg.writeLengthUint32Incl(chatty && 'startup message');
  msg.writeUint32(0x0003_0000, chatty && 'protocol version');
  msg.writeUTF8StringNullTerminated('user');
  msg.writeUTF8StringNullTerminated(user);
  msg.writeUTF8StringNullTerminated('database');
  msg.writeUTF8StringNullTerminated(db);
  msg.writeUint8(0x00, chatty && 'end of message');
  endStartupMessage();

  msg.writeUTF8String('p');
  chatty && msg.comment('= password');
  const endPasswordMessage = msg.writeLengthUint32Incl(chatty && 'password message');
  msg.writeUTF8StringNullTerminated(password);
  endPasswordMessage();

  msg.writeUTF8String('Q');
  chatty && msg.comment('= simple query');
  const endQuery = msg.writeLengthUint32Incl(chatty && 'query');
  msg.writeUTF8StringNullTerminated('SELECT now();');
  endQuery();

  // msg.writeUTF8String('X');
  // chatty && msg.comment('= terminate');
  // const endTerminate = msg.writeLengthUint32Incl();
  // endTerminate();

  chatty && log(...highlightBytes(msg.commentedString(), LogColours.client));
  write(msg.array());

  const preAuthResponse = await read();
  const preAuthBytes = new Bytes(preAuthResponse!);

  preAuthBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
  const [endAuthReq] = preAuthBytes.expectLengthUint32Incl('request');
  preAuthBytes.expectUint32(3, chatty && 'request cleartext password auth');
  endAuthReq();
  chatty && log(...highlightBytes(preAuthBytes.commentedString(true), LogColours.client));

  const postAuthResponse = await read();
  const postAuthBytes = new Bytes(postAuthResponse!);
  postAuthBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
  const [endAuthOK] = postAuthBytes.expectLengthUint32Incl(chatty && 'result');
  postAuthBytes.expectUint32(0, chatty && 'authentication successful');
  endAuthOK();

  while (postAuthBytes.remaining() > 0) {
    const msgType = postAuthBytes.readUTF8String(1);
    if (msgType === 'S') {
      chatty && postAuthBytes.comment('= parameter status');
      const [endParams, paramsRemaining] = postAuthBytes.expectLengthUint32Incl(chatty && 'run-time parameters');
      while (paramsRemaining() > 0) {
        const k = postAuthBytes.readUTF8StringNullTerminated();
        const v = postAuthBytes.readUTF8StringNullTerminated();
      }
      endParams();

    } else if (msgType === 'K') {
      chatty && postAuthBytes.comment('= back-end key data');
      const [endKeyData] = postAuthBytes.expectLengthUint32Incl();
      postAuthBytes.readUint32(chatty && 'backend process ID');
      postAuthBytes.readUint32(chatty && 'backend secret key');
      endKeyData();

    } else if (msgType === 'Z') {
      chatty && postAuthBytes.comment('= ready for query');
      const [endStatus] = postAuthBytes.expectLengthUint32Incl(chatty && 'status');
      postAuthBytes.expectUint8('I'.charCodeAt(0), chatty && '"I" = idle');
      endStatus();
    }
  }
  chatty && log(...highlightBytes(postAuthBytes.commentedString(true), LogColours.client));

  const queryResult = await read();
  const queryResultBytes = new Bytes(queryResult!);

  queryResultBytes.expectUint8('T'.charCodeAt(0), chatty && '"T" = row description');
  const [endRowDescription] = queryResultBytes.expectLengthUint32Incl();
  const fieldsPerRow = queryResultBytes.readUint16(chatty && 'fields per row');
  for (let i = 0; i < fieldsPerRow; i++) {
    const columnName = queryResultBytes.readUTF8StringNullTerminated();
    chatty && queryResultBytes.comment('column name');
    const tableOID = queryResultBytes.readUint32(chatty && 'table OID');
    const colAttrNum = queryResultBytes.readUint16(chatty && 'column attribute number');
    const dataTypeOID = queryResultBytes.readUint32(chatty && 'data type OID');
    const dataTypeSize = queryResultBytes.readUint16(chatty && 'data type size');  // TODO: these should be Int16 not Uint16
    const dataTypeModifier = queryResultBytes.readUint32(chatty && 'data type modifier');
    const formatCode = queryResultBytes.readUint16(chatty && 'format code');
  }
  endRowDescription();

  while (queryResultBytes.remaining() > 0) {
    const msgType = queryResultBytes.readUTF8String(1);
    if (msgType === 'D') {
      chatty && postAuthBytes.comment('= data row');
      const [endDataRow] = queryResultBytes.expectLengthUint32Incl();
      const columnsToFollow = queryResultBytes.readUint16(chatty && 'columns to follow');
      for (let i = 0; i < columnsToFollow; i++) {
        const [endColumn, columnRemaining] = queryResultBytes.expectLengthUint32();  // NOT including self this time
        const columnData = queryResultBytes.readUTF8String(columnRemaining());
        log(columnData);
        chatty && queryResultBytes.comment('column value');
        endColumn();
      }
      endDataRow();

    } else if (msgType === 'C') {
      chatty && postAuthBytes.comment('= close command');
      const [endClose] = queryResultBytes.expectLengthUint32Incl();
      queryResultBytes.readUTF8StringNullTerminated();
      chatty && queryResultBytes.comment('= command tag');
      endClose();

    } else if (msgType === 'Z') {
      chatty && postAuthBytes.comment('= ready for query');
      const [endReady] = queryResultBytes.expectLengthUint32Incl();
      queryResultBytes.expectUint8('I'.charCodeAt(0), chatty && '"I" = idle');
      endReady();

    } else {
      throw new Error(`Unexpected message type: ${msgType}`);
    }
  }

  chatty && log(...highlightBytes(queryResultBytes.commentedString(true), LogColours.client));
  log(`time taken: ${Date.now() - t0}ms`);
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