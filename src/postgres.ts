
import { ReadQueue } from './util/readqueue';
import Bytes from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';
import { TrustedCert } from './tls/cert';

// @ts-ignore
import isrgrootx1 from './roots/isrg-root-x1.pem';
// @ts-ignore
import isrgrootx2 from './roots/isrg-root-x2.pem';
import { hexFromU8 } from './util/hex';

export async function postgres(urlStr: string) {
  const t0 = Date.now();

  const url = parse(urlStr);
  const host = url.hostname;

  const isNeon = /[.]neon[.]tech$/.test(host);

  const port = url.port || '5432';  // not `?? '5432'`, because it's an empty string if unspecified
  const user = url.username;
  const password = isNeon ? `project=${host.match(/^[^.]+/)![0]};${url.password}` : url.password;
  const db = url.pathname.slice(1);

  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`wss://ws.manipulexity.com/v1?address=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (err) => { console.log('ws error:', err); });
    ws.addEventListener('close', () => { console.log('connection closed'); })
  });
  const reader = new ReadQueue(ws);
  const networkRead = reader.read.bind(reader);
  const networkWrite = ws.send.bind(ws);

  // https://www.postgresql.org/docs/current/protocol-message-formats.html

  const sslRequest = new Bytes(8);
  const endSslRequest = sslRequest.writeLengthUint32Incl(chatty && 'SSL request');
  sslRequest.writeUint32(0x04d2162f, 'SSL request code');
  endSslRequest();

  chatty && log('First of all, we send a fixed 8-byte sequence that asks the Postgres server if SSL/TLS is available:');

  chatty && log(...highlightBytes(sslRequest.commentedString(), LogColours.client));
  const writePreData = sslRequest.array();

  if (isNeon) {
    chatty && log('With Neon, we don’t need to wait for the reply: we run this server, so we know it’s going to answer yes. We thus save time by ploughing straight on with the TLS handshake, which begins with a ‘client hello’:');

  } else {
    networkWrite(writePreData);
    const SorN = await networkRead(1);
    chatty && log('The server responds with an ‘S’ to let us know it supports SSL/TLS.');
    chatty && log(hexFromU8(SorN!));
    if (SorN![0] !== 'S'.charCodeAt(0)) throw new Error('Did not receive ‘S’ in response to SSL Request');
    chatty && log('We then start a TLS handshake, which begins with the ‘client hello’:');
  }

  chatty && log('*** Hint: click the handshake log message below to expand. ***');

  const sslResponse = new Bytes(1);
  sslResponse.writeUTF8String('S');
  const expectPreData = sslResponse.array();

  const rootCert = TrustedCert.fromPEM(isrgrootx1 + isrgrootx2);
  const [read, write] = isNeon ?
    await startTls(host, rootCert, networkRead, networkWrite, false, writePreData, expectPreData, '"S" = SSL connection supported') :
    await startTls(host, rootCert, networkRead, networkWrite, true);

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
  msg.writeUTF8StringNullTerminated('SELECT now()');
  endQuery();

  chatty && log('We cheat a bit again here. By assuming we know how the server will respond, we can save several network round-trips and bundle up a Postgres startup message, a cleartext password message, and a simple query. Here’s the plaintext:');
  chatty && log(...highlightBytes(msg.commentedString(), LogColours.client));

  chatty && log('And the ciphertext looks like this:');
  await write(msg.array());

  chatty && log('The server now responds to each message in turn. First it responds to the startup message with a request for our password. Encrypted, as received:');

  const preAuthResponse = await read();
  const preAuthBytes = new Bytes(preAuthResponse!);

  preAuthBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
  const [endAuthReq, authReqRemaining] = preAuthBytes.expectLengthUint32Incl('request');

  const authMechanism = preAuthBytes.readUint32();
  if (authMechanism === 3) {
    chatty && preAuthBytes.comment('request cleartext password auth');

  } else if (authMechanism === 10) {
    chatty && preAuthBytes.comment('request SASL auth');
    while (authReqRemaining() > 1) {
      const mechanism = preAuthBytes.readUTF8StringNullTerminated();
    }
    preAuthBytes.expectUint8(0, 'null terminated list');

  } else {
    throw new Error(`Unsupported auth mechanism (${authMechanism})`);
  }

  endAuthReq();
  chatty && log('Decrypted and parsed:');
  chatty && log(...highlightBytes(preAuthBytes.commentedString(true), LogColours.server));

  if (authMechanism === 10) {
    chatty && log('We don’t currently support anything except cleartext auth, so we come to an abrupt end here.');
    throw new Error('Unsupported SCRAM-SHA-256 auth');
  }

  chatty && log('Next, it responds to the password we sent, and provides some other useful data. Encrypted, that’s:');

  const postAuthResponse = await read();
  const postAuthBytes = new Bytes(postAuthResponse!);

  chatty && log(...highlightBytes(postAuthBytes.commentedString(true), LogColours.server));
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
      postAuthBytes.expectUint8('I'.charCodeAt(0), chatty && '"I" = status: idle');
      endStatus();
    }
  }
  chatty && log('Decrypted and parsed:');
  chatty && log(...highlightBytes(postAuthBytes.commentedString(true), LogColours.server));

  chatty && log('Lastly, it returns our query result. Encrypted:');
  const queryResult = await read();
  const queryResultBytes = new Bytes(queryResult!);

  queryResultBytes.expectUint8('T'.charCodeAt(0), chatty && '"T" = row description');
  const [endRowDescription] = queryResultBytes.expectLengthUint32Incl();
  const fieldsPerRow = queryResultBytes.readUint16(chatty && 'fields per row');
  for (let i = 0; i < fieldsPerRow; i++) {
    const columnName = queryResultBytes.readUTF8StringNullTerminated();
    chatty && queryResultBytes.comment('= column name', queryResultBytes.offset - 1);
    const tableOID = queryResultBytes.readUint32(chatty && 'table OID');
    const colAttrNum = queryResultBytes.readUint16(chatty && 'column attribute number');
    const dataTypeOID = queryResultBytes.readUint32(chatty && 'data type OID');
    const dataTypeSize = queryResultBytes.readUint16(chatty && 'data type size');  // TODO: these should be Int16 not Uint16
    const dataTypeModifier = queryResultBytes.readUint32(chatty && 'data type modifier');
    const formatCode = queryResultBytes.readUint16(chatty && 'format code');
  }
  endRowDescription();

  let lastColumnData;
  while (queryResultBytes.remaining() > 0) {
    const msgType = queryResultBytes.readUTF8String(1);
    if (msgType === 'D') {
      chatty && queryResultBytes.comment('= data row');
      const [endDataRow] = queryResultBytes.expectLengthUint32Incl();
      const columnsToFollow = queryResultBytes.readUint16(chatty && 'columns to follow');
      for (let i = 0; i < columnsToFollow; i++) {
        const [endColumn, columnRemaining] = queryResultBytes.expectLengthUint32();  // NOT including self this time
        lastColumnData = queryResultBytes.readUTF8String(columnRemaining());
        chatty && queryResultBytes.comment('= column value');
        endColumn();
      }
      endDataRow();

    } else if (msgType === 'C') {
      chatty && queryResultBytes.comment('= close command');
      const [endClose] = queryResultBytes.expectLengthUint32Incl();
      queryResultBytes.readUTF8StringNullTerminated();
      chatty && queryResultBytes.comment('= command tag', queryResultBytes.offset - 1);
      endClose();

    } else if (msgType === 'Z') {
      chatty && queryResultBytes.comment('= ready for query');
      const [endReady] = queryResultBytes.expectLengthUint32Incl();
      queryResultBytes.expectUint8('I'.charCodeAt(0), chatty && '"I" = status: idle');
      endReady();

    } else {
      throw new Error(`Unexpected message type: ${msgType}`);
    }
  }

  chatty && log('Decrypted and parsed:');
  chatty && log(...highlightBytes(queryResultBytes.commentedString(true), LogColours.server));
  chatty && log('We pick out our result — the current time on our server:');
  log('%c%s', 'font-size: 2em', lastColumnData);
  chatty || log(`time taken: ${Date.now() - t0}ms`);

  const endBytes = new Bytes(5);
  endBytes.writeUTF8String('X');
  chatty && endBytes.comment('= terminate');
  const endTerminate = endBytes.writeLengthUint32Incl();
  endTerminate();

  chatty && log('Last of all, we send a termination command. Before encryption, that’s:');
  chatty && log(...highlightBytes(endBytes.commentedString(true), LogColours.client));
  chatty && log('And as sent on the wire:');
  await write(endBytes.array());
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