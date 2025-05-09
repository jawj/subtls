import { type RootCertsDatabase } from '../tls/cert';
import cs from '../util/cryptoProxy';
import { hkdfExtract, hkdfExpandLabel } from '../tls/hkdf';
import { log } from '../presentation/log';
import { highlightBytes, highlightColonList } from '../presentation/highlights';
import { hexFromU8, u8FromHex } from '../util/hex';
import { QUICBytes } from '../util/quicBytes';
import { Crypter } from '../tls/aesgcm';
import { LogColours } from '../presentation/appearance';
import udpTransport from '../util/udpTransport';
import makeClientHello from '../tls/makeClientHello';

const nullArray = new Uint8Array(0);

export async function quicConnect(
  host: string,
  rootCertsDatabase: RootCertsDatabase | string,
  networkRead: (bytes: number) => Promise<Uint8Array | undefined>,
  networkWrite: (data: Uint8Array) => void,
  { useSNI, protocolsForALPN, requireServerTlsExtKeyUsage, requireDigitalSigKeyUsage }: {
    useSNI?: boolean,
    protocolsForALPN?: string[],
    requireServerTlsExtKeyUsage?: boolean,
    requireDigitalSigKeyUsage?: boolean,
  } = {}
) {
  useSNI ??= true;
  requireServerTlsExtKeyUsage ??= true;
  requireDigitalSigKeyUsage ??= true;

  const initialRandom = u8FromHex('0001020304050607'); //await getRandomValues(new Uint8Array(8));
  chatty && log(...highlightColonList('initial random: ' + hexFromU8(initialRandom)));

  const initialSalt = u8FromHex('38762cf7f55934b34d179ae6a4c80cadccbb7f0a');  // the first SHA-1 collision
  chatty && log(...highlightColonList('initial salt: ' + hexFromU8(initialSalt)));

  const initialSecret = await hkdfExtract(initialSalt, initialRandom, 256);
  chatty && log(...highlightColonList('initial secret: ' + hexFromU8(initialSecret)));

  const clientInitialSecret = await hkdfExpandLabel(initialSecret, 'client in', nullArray, 32, 256);
  chatty && log(...highlightColonList('client initial secret: ' + hexFromU8(clientInitialSecret)));

  const serverInitialSecret = await hkdfExpandLabel(initialSecret, 'server in', nullArray, 32, 256);
  chatty && log(...highlightColonList('server initial secret: ' + hexFromU8(serverInitialSecret)));

  const clientInitialKeyData = await hkdfExpandLabel(clientInitialSecret, 'quic key', nullArray, 16, 256);
  chatty && log(...highlightColonList('client initial key: ' + hexFromU8(clientInitialKeyData)));

  const serverInitialKey = await hkdfExpandLabel(serverInitialSecret, 'quic key', nullArray, 16, 256);
  chatty && log(...highlightColonList('server initial key: ' + hexFromU8(serverInitialKey)));

  const clientInitialIV = await hkdfExpandLabel(clientInitialSecret, 'quic iv', nullArray, 12, 256);
  chatty && log(...highlightColonList('client initial iv: ' + hexFromU8(clientInitialIV)));

  const serverInitialIV = await hkdfExpandLabel(serverInitialSecret, 'quic iv', nullArray, 12, 256);
  chatty && log(...highlightColonList('server initial iv: ' + hexFromU8(serverInitialIV)));

  const clientInitialHPKeyData = await hkdfExpandLabel(clientInitialSecret, 'quic hp', nullArray, 16, 256);
  chatty && log(...highlightColonList('client initial header protection key: ' + hexFromU8(clientInitialHPKeyData)));

  const serverInitialHPKey = await hkdfExpandLabel(serverInitialSecret, 'quic hp', nullArray, 16, 256);
  chatty && log(...highlightColonList('server initial header protection key: ' + hexFromU8(serverInitialHPKey)));

  const initialPacket = new QUICBytes(1200);  // we're going to pad it to 1200 bytes anyway

  const unprotectedFirstByte = 0b11000000;
  // https://datatracker.ietf.org/doc/html/rfc9000#packet-initial
  //  1 = long header format
  //  1 = fixed bit, always set
  // 00 =	packet type: initial
  // 00 =	reserved, always unset
  // 00	= length of packet number field - 1, see https://datatracker.ietf.org/doc/html/rfc9000#long-header

  initialPacket.writeUint8(unprotectedFirstByte, chatty && 'first byte (protected)');

  initialPacket.writeUint32(1, chatty && 'QUIC version: 1');

  const endDestConnID = initialPacket.writeLengthUint8(chatty && 'destination connection ID');
  initialPacket.writeBytes(initialRandom);
  chatty && initialPacket.comment('destination connection ID = initial random data');
  endDestConnID();

  const sourceConnectionId = u8FromHex('635f636964'); // TODO: randomise
  const endSourceConnID = initialPacket.writeLengthUint8(chatty && 'source connection ID');
  initialPacket.writeBytes(sourceConnectionId);
  chatty && initialPacket.comment('source connection ID');
  endSourceConnID();

  initialPacket.writeQUICInt(0, chatty && 'token length');

  // from https://quic.xargs.org/#client-initial-packet
  // const tlsHandshake = u8FromHex('06 00 40 ee 01 00 00 ea 03 03 00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 00 00 06 13 01 13 02 13 03 01 00 00 bb 00 00 00 18 00 16 00 00 13 65 78 61 6d 70 6c 65 2e 75 6c 66 68 65 69 6d 2e 6e 65 74 00 0a 00 08 00 06 00 1d 00 17 00 18 00 10 00 0b 00 09 08 70 69 6e 67 2f 31 2e 30 00 0d 00 14 00 12 04 03 08 04 04 01 05 03 08 05 05 01 08 06 06 01 02 01 00 33 00 26 00 24 00 1d 00 20 35 80 72 d6 36 58 80 d1 ae ea 32 9a df 91 21 38 38 51 ed 21 a2 8e 3b 75 e9 65 d0 d2 cd 16 62 54 00 2d 00 02 01 01 00 2b 00 03 02 03 04 00 39 00 31 03 04 80 00 ff f7 04 04 80 a0 00 00 05 04 80 10 00 00 06 04 80 10 00 00 07 04 80 10 00 00 08 01 0a 09 01 0a 0a 01 03 0b 01 19 0f 05 63 5f 63 69 64');

  const ecdhKeys = await cs.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const rawPublicKeyBuffer = await cs.exportKey('raw', ecdhKeys.publicKey);
  const rawPublicKey = new Uint8Array(rawPublicKeyBuffer);

  const cryptoFrame = new QUICBytes();
  cryptoFrame.writeUint8(0x06, 'frame type: CRYPTO');
  cryptoFrame.writeQUICInt(0x00, 'offset of this CRYPTO stream data');
  const endCryptoFrame = cryptoFrame.writeQUICLength('TLS ClientHello');

  await makeClientHello(cryptoFrame, host, rawPublicKey, new Uint8Array(0), true, protocolsForALPN, h => {
    h.writeUint16(0x0039, chatty && 'extension type: QUIC transport parameters');
    const endExtData = h.writeLengthUint16(chatty && 'key share data');

    h.writeUint8(0x08, chatty && 'parameter: initial_max_streams_bidi');
    const endBidi = h.writeLengthUint8('variable-length integer');
    h.writeQUICInt(0x0a, '10');
    endBidi();

    h.writeUint8(0x09, chatty && 'parameter: initial_max_streams_uni');
    const endUni = h.writeLengthUint8('variable-length integer');
    h.writeQUICInt(0x0a, '10');
    endUni();

    h.writeUint8(0x0f, chatty && 'initial_source_connection_id');  // critical, otherwise we get: initial_source_connection_id does not match
    const endCid = h.writeLengthUint8('variable-length integer');
    h.writeBytes(sourceConnectionId);
    endCid();

    endExtData();
  });

  endCryptoFrame();
  log(...highlightBytes(cryptoFrame.commentedString(), LogColours.client));

  const payloadLength = 1 /* packet number */ + cryptoFrame.offset + 16 /* auth tag */;

  const endPacket = initialPacket.writeKnownQUICLength(payloadLength, chatty && 'payload');

  const packetNumberStart = initialPacket.offset;
  initialPacket.writeUint8(0x00, 'packet number (protected)');
  const packetNumberEnd = initialPacket.offset;

  const clientInitialKey = await cs.importKey('raw', clientInitialKeyData, { name: 'AES-GCM' }, false, ['encrypt']);
  const crypter = new Crypter('encrypt', clientInitialKey, clientInitialIV);  // TODO: use raw `encrypt` method instead?
  const encryptedPayload = await crypter.process(cryptoFrame.array(), 16, initialPacket.data.subarray(0, packetNumberEnd));

  initialPacket.writeBytes(encryptedPayload.subarray(0, encryptedPayload.length - 16));
  chatty && initialPacket.comment('encrypted payload: CRYPTO frame containing the TLS ClientHello');

  initialPacket.writeBytes(encryptedPayload.subarray(encryptedPayload.length - 16));
  chatty && initialPacket.comment('auth tag');

  endPacket();

  // header protection: 
  // https://datatracker.ietf.org/doc/html/rfc9001#name-header-protection
  // https://datatracker.ietf.org/doc/html/rfc9001#name-sample-packet-protection
  // note that SubtleCrypto has no AEC-ECB, but encrypting a sequence of zeroes using the key as the IV is equivalent here:

  const sampleStart = packetNumberStart + 4;
  const headerProtectionPayloadSample = initialPacket.data.subarray(sampleStart, sampleStart + 16);

  const headerProtectionKey = await cs.importKey('raw', clientInitialHPKeyData, { name: 'AES-CBC' }, false, ['encrypt']);
  const headerProtectionBuffer = await cs.encrypt({ name: 'AES-CBC', iv: headerProtectionPayloadSample }, headerProtectionKey, new Uint8Array(16));
  const headerProtectionResult = new Uint8Array(headerProtectionBuffer);
  log(hexFromU8(headerProtectionResult));

  initialPacket.data[0] ^= headerProtectionResult[0] & 0x0f;
  for (let i = packetNumberStart, j = 1; i < packetNumberEnd; i++, j++) {
    initialPacket.data[i] ^= headerProtectionResult[j];
  }

  initialPacket.skipWrite(1200 - initialPacket.offset, chatty && 'padding up to 1200 bytes');

  log(...highlightBytes(initialPacket.commentedString(), LogColours.client));
  networkWrite(initialPacket.array());
}

const host = 'pgjones.dev';
const { read, write } = await udpTransport(host, 443);

quicConnect(host, '', read, write, {
  useSNI: true,
  protocolsForALPN: ['h3'],
  requireServerTlsExtKeyUsage: true,
  requireDigitalSigKeyUsage: true,
})
  .then(() => {
    console.log('QUIC connection begun');
  })
  .catch((error) => {
    console.error('QUIC connection failure:', error);
  });
