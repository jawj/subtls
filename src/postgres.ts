import { fromBase64, toBase64 } from 'hextreme';
import { Bytes } from './util/bytes';
import { LogColours } from './presentation/appearance';
import { highlightBytes, highlightColonList, mutedColour, textColour } from './presentation/highlights';
import { log } from './presentation/log';
import { startTls } from './tls/startTls';
import { getRandomValues } from './util/cryptoRandom';
import cs from './util/cryptoProxy';
import type wsTransport from './util/wsTransport';
import { getRootCertsDatabase } from './util/rootCerts';
import { hexFromU8 } from './util/hex';
import { concat } from './util/array';
import { algorithmWithOID } from './tls/certUtils';
import { parseAsHTTP } from './util/parseURL';
import { LazyReadFunctionReadQueue } from './util/readQueue';

const te = new TextEncoder();

export async function postgres(
  urlStr: string,
  transportFactory: typeof wsTransport,
  pipelinedPasswordAuth = false,
) {
  const t0 = Date.now();

  const url = parseAsHTTP(urlStr);
  const host = url.hostname;

  const port = url.port || '5432';  // not `?? '5432'`, because it's an empty string if unspecified
  const db = url.pathname.slice(1);
  const user = url.username;
  const password = pipelinedPasswordAuth ?
    `project=${host.match(/^[^.]+/)![0]};${url.password}` :
    url.password;

  let done = false;
  const transport = await transportFactory(host, port, () => {
    if (!done) throw new Error('Unexpected connection close');
    chatty && log('Connection closed');
  });

  // SSLRequest

  chatty && log('First of all, we send a fixed 8-byte sequence that asks the Postgres server if SSL/TLS is available:');

  const sslRequest = new Bytes(8);
  const endSslRequest = sslRequest.writeLengthUint32Incl(chatty && 'SSL request');
  sslRequest.writeUint32(0x04d2162f, '[SSLRequest](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SSLREQUEST) code');
  endSslRequest();

  chatty && log(...highlightBytes(sslRequest.commentedString(), LogColours.client));
  const writePreData = sslRequest.array();

  transport.write(writePreData);
  const SorN = await transport.read(1);
  chatty && log('The server tells us if it can speak SSL/TLS ("S" for SSL, "N" for No SSL):');
  const byte = new Bytes(SorN);
  await byte.expectUint8(0x53, '"S" = SSL connection supported');
  chatty && log(...highlightBytes(byte.commentedString(), LogColours.server));

  // TLS connection

  const rootCerts = await getRootCertsDatabase();
  const { read: readChunk, write, userCert } = await startTls(host, rootCerts, transport.read, transport.write, {
    useSNI: !pipelinedPasswordAuth,
    requireServerTlsExtKeyUsage: false,
    requireDigitalSigKeyUsage: false,
  });

  const readQueue = new LazyReadFunctionReadQueue(readChunk);
  const read = readQueue.read.bind(readQueue);

  // StartupMessage

  chatty && log('We continue by sending Postgres a [StartupMessage](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-STARTUPMESSAGE).');

  const msg = new Bytes();
  const endStartupMessage = msg.writeLengthUint32Incl(chatty && 'StartupMessage');
  msg.writeUint32(0x0003_0000, chatty && 'protocol version');
  msg.writeUTF8StringNullTerminated('user');
  msg.writeUTF8StringNullTerminated(user);
  msg.writeUTF8StringNullTerminated('database');
  msg.writeUTF8StringNullTerminated(db);
  msg.writeUTF8StringNullTerminated('application_name');
  msg.writeUTF8StringNullTerminated('bytebybyte.dev');
  msg.writeUint8(0x00, chatty && 'end of message');
  endStartupMessage();

  // pipelined password auth

  if (pipelinedPasswordAuth) {
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

  // server response: auth request

  chatty && log('Postgres now responds with a request for authentication. Encrypted, as received:');

  const preAuthBytes = new Bytes(read);

  await preAuthBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
  const [endAuthReq, authReqRemaining] = await preAuthBytes.expectLengthUint32Incl(chatty && 'request');

  const authMechanism = await preAuthBytes.readUint32();

  const saslMechanisms = new Set<string>();
  if (authMechanism === 3) {  // password auth
    chatty && preAuthBytes.comment('request password auth ([AuthenticationCleartextPassword](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONCLEARTEXTPASSWORD))');

  } else if (authMechanism === 10) {  // SASL auth
    chatty && preAuthBytes.comment('AuthenticationSASL message: request SASL auth');
    while (authReqRemaining() > 1) {
      const mechanism = await preAuthBytes.readUTF8StringNullTerminated();
      saslMechanisms.add(mechanism);
    }
    await preAuthBytes.expectUint8(0, chatty && 'end of list');

    if (!saslMechanisms.has('SCRAM-SHA-256-PLUS')) throw new Error('This software only supports SCRAM-SHA-256-PLUS (with channel binding)');

  } else {
    throw new Error(`Unsupported auth mechanism: ${authMechanism}`);
  }

  endAuthReq();
  chatty && log('Decrypted and parsed:');
  chatty && log(...highlightBytes(preAuthBytes.commentedString(), LogColours.server));

  // SASL/SCRAM

  if (authMechanism === 10) {  // continue SASL auth
    chatty && log('So the server requires [SASL authentication](https://www.postgresql.org/docs/current/sasl-authentication.html), and the supported mechanisms are: %c' + [...saslMechanisms].join(', ') + '%c.', textColour, mutedColour);
    chatty && log('We continue by picking SCRAM-SHA-256-PLUS. This is defined in [RFC 5802](https://datatracker.ietf.org/doc/html/rfc5802) and provides channel binding (see [RFC 5056](https://datatracker.ietf.org/doc/html/rfc5056)) for some additional protection against MITM attacks.');
    chatty && log('That selection is the first part of the Postgres SASLInitialResponse we now send. The second part is a SCRAM client-first-message, which consists of three parameters: p, n and r.');
    chatty && log('p= selects the channel binding method: tls-server-end-point is the only one Postgres currently supports. A patch to also support tls-exporter ([RFC 9266](https://datatracker.ietf.org/doc/html/rfc9266)) [was discussed back in 2022](https://www.postgresql.org/message-id/YwxWWQR6uwWHBCbQ%40paquier.xyz), but ran into difficulties.');
    chatty && log('n= sets the username: we leave this empty, since [Postgres ignores this](https://www.postgresql.org/docs/current/sasl-authentication.html#SASL-SCRAM-SHA-256) in favour of the user specified in the StartupMessage above.');
    chatty && log('r= provides a 24-character random nonce, which we’ll generate now.');

    const clientNonceData = new Uint8Array(18);
    await getRandomValues(clientNonceData);
    const clientNonceStr = toBase64(clientNonceData);

    chatty && log(...highlightColonList(`client nonce: ${clientNonceStr}`));
    chatty && log('(By the standard, the nonce can include any printable ASCII characters except comma. But, [following Postgres’ lead](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/libpq/auth-scram.c#L1217), we sacrifice some entropy for the sake of convenience, generating 18 random bytes and base64-encoding them instead).');

    const saslInitResponse = new Bytes();
    saslInitResponse.writeUTF8String('p');
    chatty && saslInitResponse.comment('= SASLInitialResponse');
    const endSaslInitResponse = saslInitResponse.writeLengthUint32Incl(chatty && 'message');

    saslInitResponse.writeUTF8StringNullTerminated('SCRAM-SHA-256-PLUS');

    const gs2Header = 'p=tls-server-end-point,,';
    const endInitialClientResponse = saslInitResponse.writeLengthUint32(chatty && 'client-first-message');
    saslInitResponse.writeUTF8String(gs2Header);
    chatty && saslInitResponse.comment('(there’s an empty authzid field between these commas)');

    const clientFirstMessageBare = `n=,r=${clientNonceStr}`;
    saslInitResponse.writeUTF8String(clientFirstMessageBare);
    chatty && saslInitResponse.comment('(this part is called the client-first-message-bare)');
    endInitialClientResponse();

    endSaslInitResponse();

    chatty && log(...highlightBytes(saslInitResponse.commentedString(), LogColours.client));
    chatty && log('And as ciphertext:');
    await write(saslInitResponse.array());

    chatty && log('The server responds with an AuthenticationSASLContinue SASL challenge message. This carries the SCRAM server-first-message, made up of our random nonce extended by another 24 bytes (r), a salt (s), and an iteration count (i).');

    const serverSaslContinueBytes = new Bytes(read);
    await serverSaslContinueBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
    const [endServerSaslContinue, serverSaslContinueRemaining] = await serverSaslContinueBytes.expectLengthUint32Incl();
    await serverSaslContinueBytes.expectUint32(11, chatty && 'AuthenticationSASLContinue');
    const serverFirstMessage = await serverSaslContinueBytes.readUTF8String(serverSaslContinueRemaining());
    endServerSaslContinue();

    chatty && log(...highlightBytes(serverSaslContinueBytes.commentedString(), LogColours.server));

    const attrs = Object.fromEntries(serverFirstMessage.split(',').map(v => [v[0], v.slice(2)]));
    const { r: nonceStr, s: saltB64, i: iterationsStr } = attrs as Record<string, string>;
    const iterations = parseInt(iterationsStr, 10);

    chatty && log('%c%s', `color: ${LogColours.header}`, 'server-supplied SASL values');
    chatty && log(...highlightColonList(`nonce: ${nonceStr}`));
    chatty && log(...highlightColonList(`salt: ${saltB64}`));
    chatty && log(...highlightColonList(`number of iterations: ${iterations}`));

    if (!nonceStr.startsWith(clientNonceStr)) throw new Error('Server nonce does not extend client nonce we supplied');
    chatty && log('%c✓ nonce extends the client nonce we supplied', 'color: #8c8;');

    chatty && log('The second and final client authentication message has several elements. First, some channel-binding data (c). Second, a reiteration of the full client + server nonce (r). Those two give us the client-final-message-without-proof. And third, a proof (p) that we know the user’s password. That gives us the full client-final-message.');
    chatty && log(...highlightColonList(`The channel-binding data tells the server who we think we’re talking to. We present a hash of the end-user certificate we received from the server during the TLS handshake above. That’s the first certificate in the chain, which (as you can double-check above) is in this case: serial number ${hexFromU8(userCert.serialNumber)}, for ${userCert.subjectAltNames?.join(', ')}.`));
    chatty && log('This has a somewhat similar purpose to [certificate pinning](https://owasp.org/www-community/controls/Certificate_and_Public_Key_Pinning). It rules out some sophisticated MITM attacks in which we connect to a proxy that has a certificate that appears valid for the real server but is not the real server’s.');

    let hashAlgo = algorithmWithOID(userCert.algorithm)?.hash?.name as string;
    if (hashAlgo === 'SHA-1' || hashAlgo === 'MD5') hashAlgo = 'SHA-256';

    chatty && log(...highlightColonList(`The hash we present is determined by the certificate’s algorithm (unless that’s MD5 or SHA-1, in which case it’s upgraded to SHA-256). For this particular certificate, it’s: ${hashAlgo}.`));

    const hashedCert = new Uint8Array(await cs.digest(hashAlgo, userCert.rawData));

    chatty && log(...highlightColonList(`certificate hash: ${hexFromU8(hashedCert)}`));

    const cbindMessageB64 = toBase64(concat(te.encode(gs2Header), hashedCert));
    const clientFinalMessageWithoutProof = `c=${cbindMessageB64},r=${nonceStr}`;

    chatty && log(`The channel-binding data (c) consists of the channel-binding header we sent before (${gs2Header}), followed by this binary hash, all base64-encoded. That completes the client-final-message-without-proof.`);

    chatty && log(...highlightColonList(`client-final-message-without-proof: ${clientFinalMessageWithoutProof}`));

    const salt = fromBase64(saltB64);
    const passwordBytes = te.encode(password);

    chatty && log('So: what about the proof? Well, there are a few steps to this.');

    chatty && log('One of SCRAM authentication’s goals is to make it hard to brute-force a user’s password even given access to their stored credentials. That’s done by requiring time-consuming sequential calculations via [PBKDF2](https://en.wikipedia.org/wiki/PBKDF2).');

    chatty && log('So we now calculate a long chain of SHA-256 HMACs using the password and the salt, and XOR each result with the previous one. This is [operation Hi(str, salt, i) in RFC 5802](https://datatracker.ietf.org/doc/html/rfc5802#section-2.2).');

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

    chatty && log(...highlightColonList(`first result: ${hexFromU8(saltedPassword)}`));

    for (let i = 1; i < iterations; i++) {
      Ui = new Uint8Array(await cs.sign('HMAC', HiHmacKey, Ui));
      saltedPassword = saltedPassword.map((x, j) => x ^ Ui[j]);
    }

    chatty && log(`... ${iterations - 2} intermediate results ...`);
    chatty && log(...highlightColonList(`final result — the SaltedPassword: ${hexFromU8(saltedPassword)}`));

    const ckHmacKey = await cs.importKey(
      'raw',
      saltedPassword,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    );
    const clientKey = new Uint8Array(await cs.sign('HMAC', ckHmacKey, te.encode('Client Key')));

    chatty && log('Next, we generate the ClientKey. It’s an HMAC of the string "Client Key" using that SaltedPassword.');
    chatty && log(...highlightColonList(`ClientKey: ${hexFromU8(clientKey)}`));

    const storedKey = new Uint8Array(await cs.digest('SHA-256', clientKey));

    chatty && log('The StoredKey is then the SHA-256 hash of the ClientKey.');
    chatty && log(...highlightColonList(`StoredKey: ${hexFromU8(storedKey)}`));

    chatty && log(`The StoredKey is one of the auth parameters stored by Postgres. In fact, you’ll see the base64-encoded StoredKey ([alongside the salt, iteration count, and some other parameters](https://www.postgresql.org/docs/current/catalog-pg-authid.html)) if you run the following query against your database: SELECT rolpassword FROM pgauthid WHERE rolname='${user.replace(/'/g, "''")}'.`);

    chatty && log(...highlightColonList(`StoredKey, base64-encoded: ${toBase64(storedKey)}`));

    chatty && log('We now need to calculate the ClientSignature. This is an HMAC of the AuthMessage, which is itself a concatenation of the three previous messages sent between client and server.');

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
    chatty && log(...highlightColonList(`ClientSignature: ${hexFromU8(clientSignature)}`));

    chatty && log('And at last we can calculate the proof (p), by XORing this ClientSignature with the ClientKey.');

    const clientProof = clientKey.map((x, i) => x ^ clientSignature[i]);
    chatty && log(...highlightColonList(`ClientProof: ${hexFromU8(clientProof)}`));
    chatty && log(...highlightColonList(`ClientProof, base64-encoded: ${toBase64(clientProof)}`));

    chatty && log('We’re now ready to send the client-final-message as a Postgres SASLResponse:');

    const clientProofB64 = toBase64(clientProof);
    const clientFinalMessage = `${clientFinalMessageWithoutProof},p=${clientProofB64}`;

    const saslResponse = new Bytes();
    saslResponse.writeUTF8String('p');
    chatty && saslResponse.comment('= SASLResponse');
    const endSaslResponse = saslResponse.writeLengthUint32Incl(chatty && 'message');
    saslResponse.writeUTF8String(clientFinalMessage);
    chatty && saslResponse.comment('— the SCRAM client-final-message');
    endSaslResponse();

    chatty && log(...highlightBytes(saslResponse.commentedString(), LogColours.client));
    chatty && log('And as ciphertext:');
    await write(saslResponse.array());

    chatty && log('The server responds with a base64-encoded ServerSignature (v) — plus likely some further data that we’ll parse below.');

    const authSaslFinalBytes = new Bytes(read);
    await authSaslFinalBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
    const [endAuthSaslFinal, authSaslFinalRemaining] = await authSaslFinalBytes.expectLengthUint32Incl(chatty && 'message');
    await authSaslFinalBytes.expectUint32(12, chatty && '= AuthenticationSASLFinal');
    const saslOutcome = await authSaslFinalBytes.readUTF8String(authSaslFinalRemaining());
    chatty && authSaslFinalBytes.comment('— the base64-encoded ServerSignature');
    endAuthSaslFinal();

    chatty && log(...highlightBytes(authSaslFinalBytes.commentedString(), LogColours.server));

    chatty && log('Now we calculate a server signature for ourselves, to see that it matches up — proving that the server has a record of our credentials. First we produce the ServerKey: an HMAC of the string "Server Key" using the SaltedPassword.');

    const skHmacKey = await cs.importKey(
      'raw',
      saltedPassword,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    );
    const serverKey = new Uint8Array(await cs.sign('HMAC', skHmacKey, te.encode('Server Key')));
    chatty && log(...highlightColonList(`ServerKey: ${hexFromU8(serverKey)}`));

    chatty && log('Then we make the ServerSignature, as an HMAC of the AuthMessage (as defined above) using the ServerKey.');

    const ssbHmacKey = await cs.importKey(
      'raw',
      serverKey,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    );
    const serverSignature = new Uint8Array(await cs.sign('HMAC', ssbHmacKey, te.encode(authMessage)));
    chatty && log(...highlightColonList(`ServerSignature: ${hexFromU8(serverSignature)}`));

    const serverSignatureB64 = toBase64(serverSignature);
    chatty && log(...highlightColonList(`ServerSignature, base64-encoded: ${serverSignatureB64}`));

    const remoteServerSignatureB64 = Object.fromEntries(saslOutcome.split(',').map(v => [v[0], v.slice(2)])).v;
    if (remoteServerSignatureB64 !== serverSignatureB64) throw new Error('Server signature mismatch');

    chatty && log('%c✓ server signature matches locally-generated server signature', 'color: #8c8;');
  }

  chatty && log('The server tells us we’re in, and provides some other useful data.');

  const postAuthBytes = new Bytes(read);
  await postAuthBytes.expectUint8('R'.charCodeAt(0), chatty && '"R" = authentication request');
  const [endAuthOK] = await postAuthBytes.expectLengthUint32Incl(chatty && 'authentication result');
  await postAuthBytes.expectUint32(0, chatty && '[AuthenticationOk](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONOK)');
  endAuthOK();

  while (true) {
    const msgType = await postAuthBytes.readUTF8String(1);
    if (msgType === 'S') {
      chatty && postAuthBytes.comment('= [ParameterStatus](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARAMETERSTATUS)');
      const [endParams, paramsRemaining] = await postAuthBytes.expectLengthUint32Incl(chatty && 'run-time parameters');
      while (paramsRemaining() > 0) {
        const k = await postAuthBytes.readUTF8StringNullTerminated();
        const v = await postAuthBytes.readUTF8StringNullTerminated();
        void k, v;
      }
      endParams();

    } else if (msgType === 'K') {
      chatty && postAuthBytes.comment('= [BackendKeyData](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BACKENDKEYDATA)');
      const [endKeyData] = await postAuthBytes.expectLengthUint32Incl();
      await postAuthBytes.readUint32(chatty && 'backend process ID');
      await postAuthBytes.readUint32(chatty && 'backend secret key');
      endKeyData();

    } else if (msgType === 'Z') {
      chatty && postAuthBytes.comment('= [ReadyForQuery](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-READYFORQUERY)');
      const [endStatus] = await postAuthBytes.expectLengthUint32Incl(chatty && 'status');
      await postAuthBytes.expectUint8('I'.charCodeAt(0), chatty && '"I" = status: idle');
      endStatus();
      break;

    } else {
      throw new Error(`Unexpected message type: ${msgType} `);
    }
  }
  chatty && log('Decrypted and parsed:');
  chatty && log(...highlightBytes(postAuthBytes.commentedString(), LogColours.server));

  if (pipelinedPasswordAuth === false) {
    const query = new Bytes();
    query.writeUTF8String('Q');
    chatty && msg.comment('= [Query](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-QUERY)');
    const endQuery = query.writeLengthUint32Incl(chatty && 'query');
    query.writeUTF8StringNullTerminated('SELECT now()');
    endQuery();

    chatty && log('The ReadyForQuery message indicates, of course, that we can now send our query message. It’s pretty simple.');
    chatty && log(...highlightBytes(query.commentedString(), LogColours.client));
    chatty && log('Encrypted, that’s:');
    await write(query.array());
  }

  chatty && log('Postgres returns our query result. Encrypted:');

  const queryResultBytes = new Bytes(read);
  await queryResultBytes.expectUint8('T'.charCodeAt(0), chatty && '"T" = [RowDescription](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-ROWDESCRIPTION)');
  const [endRowDescription] = await queryResultBytes.expectLengthUint32Incl();
  const fieldsPerRow = await queryResultBytes.readUint16(chatty && 'fields per row');
  for (let i = 0; i < fieldsPerRow; i++) {
    const columnName = await queryResultBytes.readUTF8StringNullTerminated();
    chatty && queryResultBytes.comment('= column name', queryResultBytes.offset - 1);
    const tableOID = await queryResultBytes.readUint32(chatty && 'table OID');
    const colAttrNum = await queryResultBytes.readUint16(chatty && 'column attribute number');
    const dataTypeOID = await queryResultBytes.readUint32(chatty && 'data type OID');
    const dataTypeSize = await queryResultBytes.readUint16(chatty && 'data type size');  // TODO: these should be Int16 not Uint16
    const dataTypeModifier = await queryResultBytes.readUint32(chatty && 'data type modifier');
    const formatCode = await queryResultBytes.readUint16(chatty && 'format code');
    void columnName, tableOID, colAttrNum, dataTypeOID, dataTypeSize, dataTypeModifier, formatCode;
  }
  endRowDescription();

  let lastColumnData;
  while (true) {
    const msgType = await queryResultBytes.readUTF8String(1);
    if (msgType === 'D') {
      chatty && queryResultBytes.comment('= [DataRow](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-DATAROW)');
      const [endDataRow] = await queryResultBytes.expectLengthUint32Incl();
      const columnsToFollow = await queryResultBytes.readUint16(chatty && 'columns to follow');
      for (let i = 0; i < columnsToFollow; i++) {
        const [endColumn, columnRemaining] = await queryResultBytes.expectLengthUint32();  // NOT including self this time
        lastColumnData = await queryResultBytes.readUTF8String(columnRemaining());
        chatty && queryResultBytes.comment('= column value');
        endColumn();
      }
      endDataRow();

    } else if (msgType === 'C') {
      chatty && queryResultBytes.comment('= [Close](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-CLOSE)');
      const [endClose] = await queryResultBytes.expectLengthUint32Incl();
      await queryResultBytes.readUTF8StringNullTerminated();
      chatty && queryResultBytes.comment('= command tag', queryResultBytes.offset - 1);
      endClose();

    } else if (msgType === 'Z') {
      chatty && queryResultBytes.comment('= [ReadyForQuery](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-READYFORQUERY)');
      const [endReady] = await queryResultBytes.expectLengthUint32Incl();
      await queryResultBytes.expectUint8('I'.charCodeAt(0), chatty && '"I" = status: idle');
      endReady();
      break;

    } else {
      throw new Error(`Unexpected message type: ${msgType} `);
    }
  }

  chatty && log('Decrypted and parsed:');
  chatty && log(...highlightBytes(queryResultBytes.commentedString(), LogColours.server));
  chatty && log('We pick out our result — the current time on our server:');
  log('%c%s', 'font-size: 2em; color: #000;', lastColumnData);
  chatty || log(`time taken: ${Date.now() - t0} ms`);

  const endBytes = new Bytes(5);
  endBytes.writeUTF8String('X');
  chatty && endBytes.comment('= [Terminate](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-TERMINATE)');
  const endTerminate = endBytes.writeLengthUint32Incl();
  endTerminate();
  chatty && endBytes.comment('(and therefore end here too)');

  chatty && log('Last of all, we send a termination command. Before encryption, that’s:');
  chatty && log(...highlightBytes(endBytes.commentedString(), LogColours.client));
  chatty && log('And as sent on the wire:');
  await write(endBytes.array());

  chatty && log(
    `Total bytes: %c${transport.stats.written}%c sent, %c${transport.stats.read}%c received`,
    textColour, mutedColour, textColour, mutedColour
  );

  done = true;
}
