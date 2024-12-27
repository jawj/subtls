import { fromBase64, toBase64 } from 'hextreme';
import { Bytes } from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes, highlightColonList } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';
import { getRandomValues } from './util/cryptoRandom';
import cs from './util/cryptoProxy';
import type wsTransport from './util/wsTransport';

// @ts-ignore
import isrgrootx1 from './roots/isrg-root-x1.pem';
import { hexFromU8 } from './util/hex';
import { concat } from './util/array';
import { algorithmWithOID } from './tls/certUtils';

export async function postgres(urlStr: string, transportFactory: typeof wsTransport, neonPasswordPipelining = true) {
  const t0 = Date.now();

  const url = parse(urlStr);
  const host = url.hostname;

  const port = url.port || '5432';  // not `?? '5432'`, because it's an empty string if unspecified
  const db = url.pathname.slice(1);
  const user = url.username;
  const password = neonPasswordPipelining ?
    `project=${host.match(/^[^.]+/)![0]};${url.password}` :
    url.password;

  let done = false;
  const transport = await transportFactory(host, port, () => {
    if (!done) throw new Error('Unexpected connection close');
    chatty && log('Connection closed');
  });

  const sslRequest = new Bytes(8);
  const endSslRequest = sslRequest.writeLengthUint32Incl(chatty && 'SSL request');
  sslRequest.writeUint32(0x04d2162f, '[SSLRequest](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SSLREQUEST) code');
  endSslRequest();

  chatty && log('First of all, we send a fixed 8-byte sequence that asks the Postgres server if SSL/TLS is available:');

  chatty && log(...highlightBytes(sslRequest.commentedString(), LogColours.client));
  const writePreData = sslRequest.array();

  transport.write(writePreData);
  const SorN = await transport.read(1);
  chatty && log('The server tells us if it can speak SSL/TLS ("S" for yes, "N" for no):');
  const byte = new Bytes(SorN!);
  byte.expectUint8(0x53, '"S" = SSL connection supported');
  chatty && log(...highlightBytes(byte.commentedString(), LogColours.server));

  const { read, write, userCert } = await startTls(host, isrgrootx1, transport.read, transport.write, {
    useSNI: !neonPasswordPipelining,
    requireServerTlsExtKeyUsage: false,
    requireDigitalSigKeyUsage: false,
  });

  const msg = new Bytes(1024);

  const endStartupMessage = msg.writeLengthUint32Incl(chatty && '[StartupMessage](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-STARTUPMESSAGE)');
  msg.writeUint32(0x0003_0000, chatty && 'protocol version');
  msg.writeUTF8StringNullTerminated('user');
  msg.writeUTF8StringNullTerminated(user);
  msg.writeUTF8StringNullTerminated('database');
  msg.writeUTF8StringNullTerminated(db);
  msg.writeUint8(0x00, chatty && 'end of message');
  endStartupMessage();

  if (neonPasswordPipelining) {
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
  }

  chatty && log(...highlightBytes(msg.commentedString(), LogColours.client));

  chatty && log('And the ciphertext looks like this:');
  await write(msg.array());

  chatty && log('The server now responds to each message in turn. First it responds to the startup message with a request for our password. Encrypted, as received:');

  const preAuthResponse = await read();
  const preAuthBytes = new Bytes(preAuthResponse!);

  preAuthBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
  const [endAuthReq, authReqRemaining] = preAuthBytes.expectLengthUint32Incl(chatty && 'request');

  const authMechanism = preAuthBytes.readUint32();

  const saslMechanisms = [];
  if (authMechanism === 3) {  // password auth
    chatty && preAuthBytes.comment('request password auth ([AuthenticationCleartextPassword](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONCLEARTEXTPASSWORD))');

  } else if (authMechanism === 10) {  // SASL auth
    chatty && preAuthBytes.comment('AuthenticationSASL message: request SASL auth');
    while (authReqRemaining() > 1) saslMechanisms.push(preAuthBytes.readUTF8StringNullTerminated());
    preAuthBytes.expectUint8(0, chatty && 'null terminated list');

  } else {
    throw new Error(`Unsupported auth mechanism (${authMechanism})`);
  }

  endAuthReq();
  chatty && log('Decrypted and parsed:');
  chatty && log(...highlightBytes(preAuthBytes.commentedString(true), LogColours.server));

  if (authMechanism === 10 && saslMechanisms.includes('SCRAM-SHA-256')) {  // continue SASL auth
    chatty && log('The supported SASL mechanisms are: ' + saslMechanisms.join(', '));
    chatty && log('We continue by selecting SCRAM-SHA-256, as defined in [RFC 5802](https://datatracker.ietf.org/doc/html/rfc5802).');

    const saslInitResponse = new Bytes(1024);
    saslInitResponse.writeUTF8String('p');
    chatty && saslInitResponse.comment('= SASLInitialResponse');
    const endSaslInitResponse = saslInitResponse.writeLengthUint32Incl(chatty && 'message');

    saslInitResponse.writeUTF8StringNullTerminated('SCRAM-SHA-256-PLUS');

    const gs2Header = 'p=tls-server-end-point,,';
    const endInitialClientResponse = saslInitResponse.writeLengthUint32(chatty && 'message');
    saslInitResponse.writeUTF8String(gs2Header);
    chatty && saslInitResponse.comment('— the n means channel binding is unsupported, then there’s an (empty) authzid between the commas')

    const clientNonce = new Uint8Array(18);
    await getRandomValues(clientNonce);
    const clientNonceB64 = toBase64(clientNonce);

    const clientFirstMessageBare = `n=,r=${clientNonceB64}`;
    saslInitResponse.writeUTF8String(clientFirstMessageBare);
    chatty && saslInitResponse.comment('— this is ‘client-first-message-bare’: n=* represents a dummy username (which Postgres ignores in favour of the user specified in the StartupMessage above), and r is a base64-encoded 18-byte random nonce we just generated')
    endInitialClientResponse();

    endSaslInitResponse();

    chatty && log(...highlightBytes(saslInitResponse.commentedString(), LogColours.client));
    chatty && log('And as ciphertext:');
    await write(saslInitResponse.array());

    chatty && log('The server responds with a SASL challenge:');
    const serverSaslContinueResponse = await read();
    const serverSaslContinueBytes = new Bytes(serverSaslContinueResponse!);
    serverSaslContinueBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
    const [endServerSaslContinue, serverSaslContinueRemaining] = serverSaslContinueBytes.expectLengthUint32Incl();
    serverSaslContinueBytes.expectUint32(11, chatty && 'AuthenticationSASLContinue');
    const serverFirstMessage = serverSaslContinueBytes.readUTF8String(serverSaslContinueRemaining());
    chatty && serverSaslContinueBytes.comment('— this is the SCRAM ‘server-first-message’');
    endServerSaslContinue();

    chatty && log(...highlightBytes(serverSaslContinueBytes.commentedString(), LogColours.server));

    const attrs = Object.fromEntries(serverFirstMessage.split(',').map(v => [v[0], v.slice(2)]));
    const { r: nonceB64, s: saltB64, i: iterationsStr } = attrs as Record<string, string>;
    const iterations = parseInt(iterationsStr, 10);

    chatty && log('%c%s', `color: ${LogColours.header}`, `server-supplied SASL values`);
    chatty && log(...highlightColonList(`nonce: ${nonceB64}`));
    chatty && log(...highlightColonList(`salt: ${saltB64}`));
    chatty && log(...highlightColonList(`number of iterations: ${iterations}`));

    if (!nonceB64.startsWith(clientNonceB64)) throw new Error('Server nonce does not extend client nonce we supplied');
    chatty && log('%c✓ nonce extends the client nonce we supplied', 'color: #8c8;');

    const salt = fromBase64(saltB64);

    const te = new TextEncoder();
    const passwordBytes = te.encode(password);

    chatty && log('Now we calculate a long chain of SHA-256 HMACs using the password and the salt, and XOR each result with the previous one. This is [operation Hi(str, salt, i) in RFC 5802](https://datatracker.ietf.org/doc/html/rfc5802#section-2.2).');

    /*
      from RFC5802:
      Hi(str, salt, i):

        U1   := HMAC(str, salt + INT(1))
        U2   := HMAC(str, U1)
        ...
        Ui-1 := HMAC(str, Ui-2)
        Ui   := HMAC(str, Ui-1)

        Hi := U1 XOR U2 XOR ... XOR Ui
    */

    const HiHmacKey = await cs.importKey(
      'raw',
      passwordBytes,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    );
    let Ui = new Uint8Array(await cs.sign('HMAC', HiHmacKey, concat(salt, [0, 0, 0, 1])));
    let saltedPassword = Ui;

    chatty && log(...highlightColonList(`first result: ${hexFromU8(saltedPassword, ' ')}`));
    chatty && log(`... ${iterations - 2} intermediate results ...`);

    for (let i = 1; i < iterations; i++) {
      Ui = new Uint8Array(await cs.sign('HMAC', HiHmacKey, Ui));
      saltedPassword = saltedPassword.map((x, j) => x ^ Ui[j]);
    }

    chatty && log(...highlightColonList(`final result — the SaltedPassword: ${hexFromU8(saltedPassword, ' ')}`));

    const ckHmacKey = await cs.importKey(
      'raw',
      saltedPassword,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    );
    const clientKey = new Uint8Array(await cs.sign('HMAC', ckHmacKey, te.encode('Client Key')));

    chatty && log('Now we generate the ClientKey as an HMAC of the string ‘Client Key’ using the SaltedPassword.');
    chatty && log(...highlightColonList(`ClientKey: ${hexFromU8(clientKey, ' ')}`));

    const storedKey = new Uint8Array(await cs.digest('SHA-256', clientKey));

    chatty && log('The StoredKey is then just an SHA-256 hash of the ClientKey.');
    chatty && log(...highlightColonList(`StoredKey: ${hexFromU8(storedKey, ' ')}`));

    let hashAlgo = algorithmWithOID(userCert.algorithm)?.hash?.name;
    if (hashAlgo === 'SHA-1' || hashAlgo === 'MD5') hashAlgo = 'SHA-256';
    chatty && log(...highlightColonList(`certificate hash algorithm: ${hashAlgo}`));

    const hashedCert = new Uint8Array(await cs.digest(hashAlgo, userCert.rawData!));
    const cbindMessageB64 = toBase64(concat(te.encode(gs2Header), hashedCert));
    const clientFinalMessageWithoutProof = `c=${cbindMessageB64},r=${nonceB64}`;

    chatty && log('The ‘client-final-message-without-proof’ is the channel-binding message plus a reiteration of the full (client + server) nonce.');
    chatty && log(...highlightColonList(`client-final-message-without-proof: ${clientFinalMessageWithoutProof}`));

    chatty && log('The ‘client-final-message’ has a proof tacked on the end. First we calculate the ClientSignature as an HMAC of the AuthMessage: a concatenation of the three previous messages sent between client and server.');

    const authMessage = `${clientFirstMessageBare},${serverFirstMessage},${clientFinalMessageWithoutProof}`;
    chatty && log(...highlightColonList(`AuthMessage: ${authMessage}`));

    const csHmacKey = await cs.importKey(
      'raw',
      storedKey,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    );
    const clientSignature = new Uint8Array(await cs.sign('HMAC', csHmacKey, te.encode(authMessage)));
    chatty && log(...highlightColonList(`ClientSignature: ${hexFromU8(clientSignature, ' ')}`));

    chatty && log('Then we calculate the proof by XORing this ClientSignature with the ClientKey.');

    const clientProof = clientKey.map((x, i) => x ^ clientSignature[i]);
    chatty && log(...highlightColonList(`ClientProof: ${hexFromU8(clientProof, ' ')}`));

    chatty && log('We’re now ready to send the ‘client-final-message’ as a Postgres SASLResponse:');

    const clientProofB64 = toBase64(clientProof);
    const clientFinalMessage = `${clientFinalMessageWithoutProof},p=${clientProofB64}`;

    const saslResponse = new Bytes(1024);
    saslResponse.writeUTF8String('p');
    chatty && saslResponse.comment('= SASLResponse');
    const endSaslResponse = saslResponse.writeLengthUint32Incl(chatty && 'message');
    saslResponse.writeUTF8String(clientFinalMessage);
    chatty && saslResponse.comment('— the SCRAM ‘client-final-message’');
    endSaslResponse();

    chatty && log(...highlightBytes(saslResponse.commentedString(), LogColours.client));
    chatty && log('And as ciphertext:');
    await write(saslResponse.array());

    chatty && log('The server responds:');
    const authSaslFinalResponse = await read();
    const authSaslFinalBytes = new Bytes(authSaslFinalResponse!);

    console.log(new TextDecoder().decode(authSaslFinalResponse));

    authSaslFinalBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
    const [endAuthSaslFinal, authSaslFinalRemaining] = authSaslFinalBytes.expectLengthUint32Incl(chatty && 'message');
    authSaslFinalBytes.expectUint32(12, chatty && '= AuthenticationSASLFinal');
    const saslOutcome = authSaslFinalBytes.readUTF8String(authSaslFinalRemaining());
    chatty && authSaslFinalBytes.comment('— the base64-encoded ServerSignature');
    endAuthSaslFinal();

    chatty && log(...highlightBytes(authSaslFinalBytes.commentedString(), LogColours.server));

    chatty && log('Now we calculate a server signature for ourselves, to see that it matches up. First we produce the ServerKey: an HMAC of the string ‘Server Key’ using the SaltedPassword.');

    const skHmacKey = await cs.importKey(
      'raw',
      saltedPassword,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    );
    const serverKey = new Uint8Array(await cs.sign('HMAC', skHmacKey, te.encode('Server Key')));
    chatty && log(...highlightColonList(`ServerKey: ${hexFromU8(serverKey, ' ')}`));

    chatty && log('Then we make the ServerSignature, as an HMAC of the AuthMessage (as defined above) using the ServerKey.')

    const ssbHmacKey = await cs.importKey(
      'raw',
      serverKey,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    );
    const serverSignature = new Uint8Array(await cs.sign('HMAC', ssbHmacKey, te.encode(authMessage)));
    const serverSignatureB64 = toBase64(serverSignature);
    chatty && log(...highlightColonList(`base64-encoded ServerSignature: ${serverSignatureB64}`));

    const remoteServerSignatureB64 = Object.fromEntries(saslOutcome.split(',').map(v => [v[0], v.slice(2)])).v;
    if (remoteServerSignatureB64 !== serverSignatureB64) throw new Error('Server signature mismatch');

    chatty && log('%c✓ server signature matches locally-generated server signature', 'color: #8c8;');
  }

  chatty && log('Now the server tells us we’re in, and provides some other useful data. Encrypted, that’s:');

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

  if (neonPasswordPipelining === false) {
    const query = new Bytes(1024)
    query.writeUTF8String('Q');
    chatty && msg.comment('= [Query](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-QUERY)');
    const endQuery = query.writeLengthUint32Incl(chatty && 'query');
    query.writeUTF8StringNullTerminated('SELECT now()');
    endQuery();

    chatty && log('At last we can send our query message.');
    chatty && log(...highlightBytes(query.commentedString(), LogColours.client));
    chatty && log('Encrypted, that’s:');
    await write(query.array());
  }

  chatty && log('Postgres returns our query result. Encrypted:');
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
      throw new Error(`Unexpected message type: ${msgType} `);
    }
  }

  chatty && log('Decrypted and parsed:');
  chatty && log(...highlightBytes(queryResultBytes.commentedString(true), LogColours.server));
  chatty && log('We pick out our result — the current time on our server:');
  log('%c%s', 'font-size: 2em; color: #000;', lastColumnData);
  chatty || log(`time taken: ${Date.now() - t0} ms`);

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
