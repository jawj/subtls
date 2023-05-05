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

export async function postgres(urlStr: string, transportFactory: typeof wsTransport) {
  const t0 = Date.now();

  const url = parse(urlStr);
  const host = url.hostname;

  const isNeon = /[.]neon[.]tech$/.test(host);
  const pipelineSSLRequest = false;  // previously: = isNeon
  const useSNIHack = isNeon;

  const port = url.port || '5432';  // not `?? '5432'`, because it's an empty string if unspecified
  const user = url.username;
  const password = useSNIHack ? `project=${host.match(/^[^.]+/)![0]};${url.password}` : url.password;
  const db = url.pathname.slice(1);

  let done = false;
  const transport = await transportFactory(host, port, () => {
    if (!done) throw new Error('Unexpected connection close');
  });

  const sslRequest = new Bytes(8);
  const endSslRequest = sslRequest.writeLengthUint32Incl(chatty && 'SSL request');
  sslRequest.writeUint32(0x04d2162f, '[SSLRequest](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SSLREQUEST) code');
  endSslRequest();

  chatty && log('First of all, we send a fixed 8-byte sequence that asks the Postgres server if SSL/TLS is available:');

  chatty && log(...highlightBytes(sslRequest.commentedString(), LogColours.client));
  const writePreData = sslRequest.array();

  if (pipelineSSLRequest) {
    chatty && log('With Neon, we don’t need to wait for the reply: we run this server, so we know it’s going to answer yes. We thus save time by ploughing straight on with the TLS handshake, which begins with a ‘client hello’:');

  } else {
    transport.write(writePreData);
    const SorN = await transport.read(1);
    chatty && log('The server tells us if it can speak SSL/TLS ("S" for yes, "N" for no):');
    const byte = new Bytes(SorN!);
    byte.expectUint8(0x53, '"S" = SSL connection supported');
    chatty && log(...highlightBytes(byte.commentedString(), LogColours.server));
    chatty && log('We then start a TLS handshake, which begins with the ‘client hello’ ([source](https://github.com/jawj/subtls/blob/main/src/tls/makeClientHello.ts)):');
  }

  const sslResponse = new Bytes(1);
  sslResponse.writeUTF8String('S');
  const expectPreData = sslResponse.array();

  const rootCert = TrustedCert.fromPEM(isrgrootx1 + isrgrootx2);
  const [read, write] = pipelineSSLRequest ?
    await startTls(host, rootCert, transport.read, transport.write, !useSNIHack, writePreData, expectPreData, '"S" = SSL connection supported') :
    await startTls(host, rootCert, transport.read, transport.write, !useSNIHack);

  const msg = new Bytes(1024);

  const endStartupMessage = msg.writeLengthUint32Incl(chatty && '[StartupMessage](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-STARTUPMESSAGE)');
  msg.writeUint32(0x0003_0000, chatty && 'protocol version');
  msg.writeUTF8StringNullTerminated('user');
  msg.writeUTF8StringNullTerminated(user);
  msg.writeUTF8StringNullTerminated('database');
  msg.writeUTF8StringNullTerminated(db);
  msg.writeUint8(0x00, chatty && 'end of message');
  endStartupMessage();

  msg.writeUTF8String('p');
  chatty && msg.comment('= [PasswordMessage](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PASSWORDMESSAGE)');
  const endPasswordMessage = msg.writeLengthUint32Incl(chatty && 'password message');
  msg.writeUTF8StringNullTerminated(password);
  endPasswordMessage();

  msg.writeUTF8String('Q');
  chatty && msg.comment('= [Query](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-QUERY)');
  const endQuery = msg.writeLengthUint32Incl(chatty && 'query');
  msg.writeUTF8StringNullTerminated('SELECT now()');
  endQuery();

  chatty && log('So: we now resume our Postgres communications. Because we know what authentication scheme the server will offer, we can save several network round-trips and bundle up a Postgres startup message, a cleartext password message, and a simple query. Here’s the pipelined plaintext:');
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
    chatty && preAuthBytes.comment('request password auth ([AuthenticationCleartextPassword](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONCLEARTEXTPASSWORD))');

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

  postAuthBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
  const [endAuthOK] = postAuthBytes.expectLengthUint32Incl(chatty && 'authentication result');
  postAuthBytes.expectUint32(0, chatty && '[AuthenticationOk](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONOK)');
  endAuthOK();

  while (postAuthBytes.remaining() > 0) {
    const msgType = postAuthBytes.readUTF8String(1);
    if (msgType === 'S') {
      chatty && postAuthBytes.comment('= [ParameterStatus](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARAMETERSTATUS)');
      const [endParams, paramsRemaining] = postAuthBytes.expectLengthUint32Incl(chatty && 'run-time parameters');
      while (paramsRemaining() > 0) {
        const k = postAuthBytes.readUTF8StringNullTerminated();
        const v = postAuthBytes.readUTF8StringNullTerminated();
        void k, v;
      }
      endParams();

    } else if (msgType === 'K') {
      chatty && postAuthBytes.comment('= [BackendKeyData](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BACKENDKEYDATA)');
      const [endKeyData] = postAuthBytes.expectLengthUint32Incl();
      postAuthBytes.readUint32(chatty && 'backend process ID');
      postAuthBytes.readUint32(chatty && 'backend secret key');
      endKeyData();

    } else if (msgType === 'Z') {
      chatty && postAuthBytes.comment('= [ReadyForQuery](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-READYFORQUERY)');
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

  queryResultBytes.expectUint8('T'.charCodeAt(0), chatty && '"T" = [RowDescription](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-ROWDESCRIPTION)');
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
    void columnName, tableOID, colAttrNum, dataTypeOID, dataTypeSize, dataTypeModifier, formatCode;
  }
  endRowDescription();

  let lastColumnData;
  while (queryResultBytes.remaining() > 0) {
    const msgType = queryResultBytes.readUTF8String(1);
    if (msgType === 'D') {
      chatty && queryResultBytes.comment('= [DataRow](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-DATAROW)');
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
      chatty && queryResultBytes.comment('= [Close](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-CLOSE)');
      const [endClose] = queryResultBytes.expectLengthUint32Incl();
      queryResultBytes.readUTF8StringNullTerminated();
      chatty && queryResultBytes.comment('= command tag', queryResultBytes.offset - 1);
      endClose();

    } else if (msgType === 'Z') {
      chatty && queryResultBytes.comment('= [ReadyForQuery](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-READYFORQUERY)');
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
  chatty && endBytes.comment('= [Terminate](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-TERMINATE)');
  const endTerminate = endBytes.writeLengthUint32Incl();
  endTerminate();

  chatty && log('Last of all, we send a termination command. Before encryption, that’s:');
  chatty && log(...highlightBytes(endBytes.commentedString(true), LogColours.client));
  chatty && log('And as sent on the wire:');
  await write(endBytes.array());

  done = true;
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
