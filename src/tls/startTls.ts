import makeClientHello from './makeClientHello';
import parseServerHello from './parseServerHello';
import { makeEncryptedTlsRecords, readEncryptedTlsRecord, readTlsRecord, RecordType } from './tlsRecord';
import { getApplicationKeys, getHandshakeKeys, hkdfExpandLabel } from './keys';
import { Crypter } from './aesgcm';
import { readEncryptedHandshake } from './readEncryptedHandshake';
import Bytes from '../util/bytes';
import { concat, equal } from '../util/array';
import { hexFromU8 } from '../util/hex';
import { LogColours } from '../presentation/appearance';
import { highlightBytes } from '../presentation/highlights';
import { log } from '../presentation/log';
import { TrustedCert } from './cert';


export async function startTls(
  host: string,
  rootCerts: TrustedCert[],
  networkRead: (bytes: number) => Promise<Uint8Array | undefined>,
  networkWrite: (data: Uint8Array) => void,
  useSNI = true,
  writePreData?: Uint8Array,
  expectPreData?: Uint8Array,
  commentPreData?: string,
) {
  const ecdhKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const rawPublicKey = await crypto.subtle.exportKey('raw', ecdhKeys.publicKey);

  // client hello
  const sessionId = new Uint8Array(32);
  crypto.getRandomValues(sessionId);
  const clientHello = makeClientHello(host, rawPublicKey, sessionId, useSNI);
  chatty && log(...highlightBytes(clientHello.commentedString(), LogColours.client));
  const clientHelloData = clientHello.array();
  const initialData = writePreData ? concat(writePreData, clientHelloData) : clientHelloData;
  networkWrite(initialData);

  if (expectPreData) {
    const receivedPreData = await networkRead(expectPreData.length);
    if (!receivedPreData || !equal(receivedPreData, expectPreData)) throw new Error('Pre data did not match expectation');
    chatty && log('The server responds:');
    chatty && log(...highlightBytes(hexFromU8(receivedPreData) + '  ' + commentPreData, LogColours.server));
  }

  // parse server hello
  const serverHelloRecord = await readTlsRecord(networkRead, RecordType.Handshake);
  if (serverHelloRecord === undefined) throw new Error('Connection closed while awaiting server hello');
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverPublicKey = parseServerHello(serverHello, sessionId);
  chatty && log(...highlightBytes(serverHelloRecord.header.commentedString() + serverHello.commentedString(), LogColours.server));

  // parse dummy cipher change
  const changeCipherRecord = await readTlsRecord(networkRead, RecordType.ChangeCipherSpec);
  if (changeCipherRecord === undefined) throw new Error('Connection closed awaiting server cipher change');
  const ccipher = new Bytes(changeCipherRecord.content);
  const [endCipherPayload] = ccipher.expectLength(1);
  ccipher.expectUint8(0x01, chatty && 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  endCipherPayload();
  chatty && log('For the benefit of badly-written middleboxes that are following along expecting TLS 1.2, the server sends a meaningless cipher change record:');
  chatty && log(...highlightBytes(changeCipherRecord.header.commentedString() + ccipher.commentedString(), LogColours.server));

  // handshake keys, encryption/decryption instances
  chatty && log('Both sides of the exchange now have everything they need to calculate the keys and IVs that will protect the rest of the handshake:');
  chatty && log('%c%s', `color: ${LogColours.header}`, 'handshake key computations');
  const clientHelloContent = clientHelloData.subarray(5);  // cut off the 5-byte record header
  const serverHelloContent = serverHelloRecord.content;    // 5-byte record header is already excluded
  const hellos = concat(clientHelloContent, serverHelloContent);
  const handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16);  // would be 384, 32 for AES256_SHA384
  const serverHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.serverHandshakeKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const handshakeDecrypter = new Crypter('decrypt', serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await crypto.subtle.importKey('raw', handshakeKeys.clientHandshakeKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const handshakeEncrypter = new Crypter('encrypt', clientHandshakeKey, handshakeKeys.clientHandshakeIV);

  chatty && log('The server sends one or more encrypted records containing the rest of its handshake messages. These include the ‘certificate verify’ message, which we check on the spot, and the full certificate chain, which we verify a bit later on:');
  const readHandshakeRecord = async () => {
    const tlsRecord = await readEncryptedTlsRecord(networkRead, handshakeDecrypter, RecordType.Handshake);
    if (tlsRecord === undefined) throw new Error('Premature end of encrypted server handshake');
    return tlsRecord;
  };
  const serverHandshake = await readEncryptedHandshake(host, readHandshakeRecord, handshakeKeys.serverSecret, hellos, rootCerts);

  // dummy cipher change
  chatty && log('For the benefit of badly-written middleboxes that are following along expecting TLS 1.2, it’s the client’s turn to send a meaningless cipher change record:');
  const clientCipherChange = new Bytes(6);
  clientCipherChange.writeUint8(0x14, chatty && 'record type: ChangeCipherSpec');
  clientCipherChange.writeUint16(0x0303, chatty && 'TLS version 1.2 (middlebox compatibility)');
  const endClientCipherChangePayload = clientCipherChange.writeLengthUint16();
  clientCipherChange.writeUint8(0x01, chatty && 'dummy ChangeCipherSpec payload (middlebox compatibility)');
  endClientCipherChangePayload();
  chatty && log(...highlightBytes(clientCipherChange.commentedString(), LogColours.client));
  const clientCipherChangeData = clientCipherChange.array();  // to be sent below

  chatty && log('Next, we send a ’handshake finished’ message, which includes an HMAC of (nearly) the whole handshake to date. This is how it looks before encryption:');

  // hash of whole handshake (note: dummy cipher change is excluded)
  const wholeHandshake = concat(hellos, serverHandshake);
  const wholeHandshakeHashBuffer = await crypto.subtle.digest('SHA-256', wholeHandshake);
  const wholeHandshakeHash = new Uint8Array(wholeHandshakeHashBuffer);

  // client handshake finished
  const finishedKey = await hkdfExpandLabel(handshakeKeys.clientSecret, 'finished', new Uint8Array(0), 32 /* = hashBytes */, 256);
  const verifyHmacKey = await crypto.subtle.importKey('raw', finishedKey, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign']);
  const verifyDataBuffer = await crypto.subtle.sign('HMAC', verifyHmacKey, wholeHandshakeHash);
  const verifyData = new Uint8Array(verifyDataBuffer);

  const clientFinishedRecord = new Bytes(36);
  clientFinishedRecord.writeUint8(0x14, chatty && 'handshake message type: finished');
  const clientFinishedRecordEnd = clientFinishedRecord.writeLengthUint24(chatty && 'handshake finished data');
  clientFinishedRecord.writeBytes(verifyData);
  chatty && clientFinishedRecord.comment('verify data');
  clientFinishedRecordEnd();
  chatty && log(...highlightBytes(clientFinishedRecord.commentedString(), LogColours.client));

  chatty && log('And here it is encrypted with the client’s handshake key and ready to go:');
  const encryptedClientFinished = await makeEncryptedTlsRecords(clientFinishedRecord.array(), handshakeEncrypter, RecordType.Handshake);  // to be sent below

  // application keys, encryption/decryption instances
  chatty && log('Both parties now have what they need to calculate the keys and IVs that will protect the application data:');
  chatty && log('%c%s', `color: ${LogColours.header}`, 'application key computations');
  const applicationKeys = await getApplicationKeys(handshakeKeys.handshakeSecret, wholeHandshakeHash, 256, 16);
  const clientApplicationKey = await crypto.subtle.importKey('raw', applicationKeys.clientApplicationKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const applicationEncrypter = new Crypter('encrypt', clientApplicationKey, applicationKeys.clientApplicationIV);
  const serverApplicationKey = await crypto.subtle.importKey('raw', applicationKeys.serverApplicationKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const applicationDecrypter = new Crypter('decrypt', serverApplicationKey, applicationKeys.serverApplicationIV);



  let wroteFinishedRecords = false;

  chatty && log('The TLS connection is established, and server and client can start exchanging encrypted application data.');

  const read = () => {
    if (!wroteFinishedRecords) {
      const finishedRecords = concat(clientCipherChangeData, ...encryptedClientFinished);
      networkWrite(finishedRecords);
      wroteFinishedRecords = true;
    }
    return readEncryptedTlsRecord(networkRead, applicationDecrypter)
  };

  const write = async (data: Uint8Array) => {
    const encryptedRecords = await makeEncryptedTlsRecords(data, applicationEncrypter, RecordType.Application);

    const allRecords = wroteFinishedRecords ?
      concat(...encryptedRecords) :
      concat(clientCipherChangeData, ...encryptedClientFinished, ...encryptedRecords);

    networkWrite(allRecords);
    wroteFinishedRecords = true;
  };

  return [read, write] as const;
}
