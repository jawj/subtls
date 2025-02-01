import { fromBase64 } from 'hextreme';
import makeClientHello from './makeClientHello';
import parseServerHello from './parseServerHello';
import { bytesFromEncryptedTlsRecords, bytesFromTlsRecords, makeEncryptedTlsRecords, readEncryptedTlsRecord } from './tlsRecord';
import { RecordType } from './tlsRecordUtils';
import { getApplicationKeys, getHandshakeKeys } from './keys';
import { hkdfExpandLabel } from './hkdf';
import { Crypter } from './aesgcm';
import { parseEncryptedHandshake } from './parseEncryptedHandshake';
import { Bytes } from '../util/bytes';
import { concat, equal } from '../util/array';
import { hexFromU8 } from '../util/hex';
import { LogColours } from '../presentation/appearance';
import { highlightBytes, highlightColonList } from '../presentation/highlights';
import { log, appendLog } from '../presentation/log';
import { TrustedCert, type RootCertsDatabase } from './cert';
import cs from '../util/cryptoProxy';
import { getRandomValues } from '../util/cryptoRandom';

export async function startTls(
  host: string,
  rootCertsDatabase: RootCertsDatabase | string,
  networkRead: (bytes: number) => Promise<Uint8Array | undefined>,
  networkWrite: (data: Uint8Array) => void,
  { useSNI, protocolsForALPN, requireServerTlsExtKeyUsage, requireDigitalSigKeyUsage, writePreData, expectPreData, commentPreData }: {
    useSNI?: boolean,
    protocolsForALPN?: string[],
    requireServerTlsExtKeyUsage?: boolean,
    requireDigitalSigKeyUsage?: boolean,
    writePreData?: Uint8Array,
    expectPreData?: Uint8Array,
    commentPreData?: string,
  } = {}
) {
  useSNI ??= true;
  requireServerTlsExtKeyUsage ??= true;
  requireDigitalSigKeyUsage ??= true;

  if (typeof rootCertsDatabase === 'string') rootCertsDatabase = await TrustedCert.databaseFromPEM(rootCertsDatabase);

  const ecdhKeys = await cs.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const rawPublicKeyBuffer = await cs.exportKey('raw', ecdhKeys.publicKey);
  const rawPublicKey = new Uint8Array(rawPublicKeyBuffer);

  if (chatty) {
    const privateKeyJWK = await cs.exportKey('jwk', ecdhKeys.privateKey);
    log('We begin the TLS connection by generating an [ECDH](https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman) key pair using curve [P-256](https://neuromancer.sk/std/nist/P-256). The private key, d, is simply a 256-bit integer picked at random:');
    log(...highlightColonList('d: ' + hexFromU8(fromBase64(privateKeyJWK.d!, { alphabet: 'base64url' }))));
    log('The public key is a point on the curve. The point is [derived from d and a base point](https://curves.xargs.org). It’s identified by coordinates x and y.');
    log(...highlightColonList('x: ' + hexFromU8(fromBase64(privateKeyJWK.x!, { alphabet: 'base64url' }))));
    log(...highlightColonList('y: ' + hexFromU8(fromBase64(privateKeyJWK.y!, { alphabet: 'base64url' }))));
  }

  chatty && log('Now we have a public/private key pair, we can start the TLS handshake by sending a client hello message ([source](https://github.com/jawj/subtls/blob/main/src/tls/makeClientHello.ts)). This includes the public key:');

  // client hello
  const sessionId = new Uint8Array(32);
  await getRandomValues(sessionId);

  const clientHello = await makeClientHello(host, rawPublicKey, sessionId, useSNI, protocolsForALPN);
  chatty && log(...highlightBytes(clientHello.commentedString(), LogColours.client));
  const clientHelloData = clientHello.array();
  const initialData = writePreData ? concat(writePreData, clientHelloData) : clientHelloData;
  networkWrite(initialData);

  chatty && log('The server returns a response, which includes its own public key, and we parse it ([source](https://github.com/jawj/subtls/blob/main/src/tls/parseServerHello.ts)):');
  if (expectPreData) {
    const receivedPreData = await networkRead(expectPreData.length);
    if (!receivedPreData || !equal(receivedPreData, expectPreData)) throw new Error('Pre data did not match expectation');
    chatty && log(...highlightBytes(hexFromU8(receivedPreData) + '  ' + commentPreData, LogColours.server));
  }

  // parse server hello
  const serverHello = bytesFromTlsRecords(networkRead, RecordType.Handshake);
  const serverPublicKey = await parseServerHello(serverHello, sessionId);
  chatty && log(appendLog, ...highlightBytes(serverHello.commentedString(false), LogColours.server));

  // parse dummy cipher change
  chatty && log('For the benefit of badly-written middleboxes that are following along expecting TLS 1.2, the server sends us a meaningless cipher change record:');
  const ccipher = bytesFromTlsRecords(networkRead, RecordType.ChangeCipherSpec);
  await ccipher.expectUint8(0x01, chatty && 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  chatty && log(appendLog, ...highlightBytes(ccipher.commentedString(false), LogColours.server));

  // handshake keys, encryption/decryption instances
  chatty && log('Both sides of the exchange now have everything they need to calculate the keys and IVs that will protect the rest of the handshake:');
  chatty && log('%c%s', `color: ${LogColours.header}`, 'handshake key computations ([source](https://github.com/jawj/subtls/blob/main/src/tls/keys.ts))');
  const clientHelloContent = clientHelloData.subarray(5);  // cut off the 5-byte record header
  const serverHelloContent = serverHello.array();    // 5-byte record header is already excluded
  const hellos = concat(clientHelloContent, serverHelloContent);
  const handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16);  // would be 384, 32 for AES256_SHA384
  const serverHandshakeKey = await cs.importKey('raw', handshakeKeys.serverHandshakeKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const handshakeDecrypter = new Crypter('decrypt', serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await cs.importKey('raw', handshakeKeys.clientHandshakeKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const handshakeEncrypter = new Crypter('encrypt', clientHandshakeKey, handshakeKeys.clientHandshakeIV);

  // parse encyrpted handshake
  chatty && log('The server continues by sending one or more encrypted records containing the rest of its handshake messages. These include the ‘certificate verify’ message, which we check on the spot, and the full certificate chain, which we verify a bit later on:');
  const handshakeBytes = bytesFromEncryptedTlsRecords(networkRead, handshakeDecrypter, RecordType.Handshake);
  const { handshakeData: serverHandshake, clientCertRequested, userCert, protocolFromALPN } = await parseEncryptedHandshake(
    host,
    handshakeBytes,
    handshakeKeys.serverSecret,
    hellos,
    rootCertsDatabase,
    requireServerTlsExtKeyUsage,
    requireDigitalSigKeyUsage,
  );

  // send dummy cipher change
  chatty && log('For the benefit of badly-written middleboxes that are following along expecting TLS 1.2, it’s the client’s turn to send a meaningless cipher change record:');
  const clientCipherChange = new Bytes();
  clientCipherChange.writeUint8(0x14, chatty && 'record type: ChangeCipherSpec');
  clientCipherChange.writeUint16(0x0303, chatty && 'TLS version 1.2 (middlebox compatibility)');
  const endClientCipherChangePayload = clientCipherChange.writeLengthUint16();
  clientCipherChange.writeUint8(0x01, chatty && 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  endClientCipherChangePayload();
  chatty && log(...highlightBytes(clientCipherChange.commentedString(), LogColours.client));
  const clientCipherChangeData = clientCipherChange.array();  // to be sent below

  // empty client certificate, if requested
  let clientCertRecordData = new Uint8Array(0);
  if (clientCertRequested) {
    const clientCertRecord = new Bytes();
    clientCertRecord.writeUint8(0x0b, chatty && 'handshake message type: client certificate');
    const endClientCerts = clientCertRecord.writeLengthUint24('client certificate data');
    clientCertRecord.writeUint8(0x00, chatty && 'certificate context: none');
    clientCertRecord.writeUint24(0x000000, chatty && 'certificate list: empty');
    endClientCerts();
    clientCertRecordData = clientCertRecord.array();

    chatty && log('Since a client cert was requested, we’re obliged to send a blank one. Here it is unencrypted:');
    chatty && log(...highlightBytes(clientCertRecord.commentedString(), LogColours.client));
  }

  chatty && log('Next, we send a ‘handshake finished’ message, which includes an HMAC of the handshake to date. This is how it looks before encryption:');

  // hash of whole handshake (note: dummy cipher change is excluded)
  const wholeHandshake = concat(hellos, serverHandshake, clientCertRecordData);
  const wholeHandshakeHashBuffer = await cs.digest('SHA-256', wholeHandshake);
  const wholeHandshakeHash = new Uint8Array(wholeHandshakeHashBuffer);

  // client handshake finished
  const finishedKey = await hkdfExpandLabel(handshakeKeys.clientSecret, 'finished', new Uint8Array(0), 32 /* = hashBytes */, 256);
  const verifyHmacKey = await cs.importKey('raw', finishedKey, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign']);
  const verifyDataBuffer = await cs.sign('HMAC', verifyHmacKey, wholeHandshakeHash);
  const verifyData = new Uint8Array(verifyDataBuffer);

  const clientFinishedRecord = new Bytes();
  clientFinishedRecord.writeUint8(0x14, chatty && 'handshake message type: finished');
  const clientFinishedRecordEnd = clientFinishedRecord.writeLengthUint24(chatty && 'handshake finished data');
  clientFinishedRecord.writeBytes(verifyData);
  chatty && clientFinishedRecord.comment('verify data');
  clientFinishedRecordEnd();
  const clientFinishedRecordData = clientFinishedRecord.array();
  chatty && log(...highlightBytes(clientFinishedRecord.commentedString(), LogColours.client));

  chatty && log('And here’s the client certificate (if requested) and handshake finished messages encrypted with the client’s handshake key and ready to go:');
  const encryptedClientFinished = await makeEncryptedTlsRecords(concat(clientCertRecordData, clientFinishedRecordData), handshakeEncrypter, RecordType.Handshake);  // to be sent below

  // note: if a client cert was requested, the application keys are calculated using a different (smaller) set of messages
  // than the handshake finished message; namely, the (empty) client cert record is omitted
  let partialHandshakeHash = wholeHandshakeHash;
  if (clientCertRecordData.length > 0) {
    const partialHandshake = wholeHandshake.subarray(0, wholeHandshake.length - clientCertRecordData.length);
    const partialHandshakeHashBuffer = await cs.digest('SHA-256', partialHandshake);
    partialHandshakeHash = new Uint8Array(partialHandshakeHashBuffer);
  }

  // application keys, encryption/decryption instances
  chatty && log('Both parties now have what they need to calculate the keys and IVs that will protect the application data:');
  chatty && log('%c%s', `color: ${LogColours.header}`, 'application key computations ([source](https://github.com/jawj/subtls/blob/main/src/tls/keys.ts))');
  const applicationKeys = await getApplicationKeys(handshakeKeys.handshakeSecret, partialHandshakeHash, 256, 16);
  const clientApplicationKey = await cs.importKey('raw', applicationKeys.clientApplicationKey, { name: 'AES-GCM' }, true /* TODO make false */, ['encrypt']);
  const applicationEncrypter = new Crypter('encrypt', clientApplicationKey, applicationKeys.clientApplicationIV);
  const serverApplicationKey = await cs.importKey('raw', applicationKeys.serverApplicationKey, { name: 'AES-GCM' }, true /* TODO make false */, ['decrypt']);
  const applicationDecrypter = new Crypter('decrypt', serverApplicationKey, applicationKeys.serverApplicationIV);

  let wroteFinishedRecords = false;

  chatty && log('The TLS connection is established, and server and client can start exchanging encrypted application data.');

  const read = () => {
    if (!wroteFinishedRecords) {
      const finishedRecords = concat(clientCipherChangeData, ...encryptedClientFinished);
      networkWrite(finishedRecords);
      wroteFinishedRecords = true;
    }
    return readEncryptedTlsRecord(networkRead, applicationDecrypter);
  };

  const write = async (data: Uint8Array) => {
    const localWroteFinishedRecords = wroteFinishedRecords;
    wroteFinishedRecords = true;

    const encryptedRecords = await makeEncryptedTlsRecords(data, applicationEncrypter, RecordType.Application);

    const allRecords = localWroteFinishedRecords ?
      concat(...encryptedRecords) :
      concat(clientCipherChangeData, ...encryptedClientFinished, ...encryptedRecords);

    networkWrite(allRecords);
  };

  const end = async () => {
    // send a close-notify Alert record
    const [alertRecord] = await makeEncryptedTlsRecords(new Uint8Array([0x01, 0x00]), applicationEncrypter, RecordType.Alert);
    networkWrite(alertRecord);
  };

  return { read, write, end, userCert, protocolFromALPN } as const;
}
