import { type RootCertsDatabase } from '../tls/cert';
import cs from '../util/cryptoProxy';

import { getInitialKeys, type Keys } from './keys';
import { log } from '../presentation/log';
import { highlightBytes } from '../presentation/highlights';
import { hexFromU8 } from '../util/hex';
import { QUICBytes } from '../util/quicBytes';
import { LogColours } from '../presentation/appearance';
import udpTransport from '../util/udpTransport';
import makeClientHello from '../tls/makeClientHello';
import { getRandomValues } from '../util/cryptoRandom';
import { concat, equal } from '../util/array';
import { Crypter } from '../tls/aesgcm';


async function makeClientInitialPacket(keys: Keys, sourceConnectionId: Uint8Array, protocolsForALPN: string[]) {
  const p = new QUICBytes(1200);  // we're going to pad it to 1200 bytes anyway

  const unprotectedFirstByte = 0b11000000;
  // https://datatracker.ietf.org/doc/html/rfc9000#packet-initial
  //  1 = long header format
  //  1 = fixed bit, always set
  // 00 =	packet type: initial
  // 00 =	reserved, always unset
  // 00	= length of packet number field - 1, see https://datatracker.ietf.org/doc/html/rfc9000#long-header

  p.writeUint8(unprotectedFirstByte, chatty && `first byte, protected (raw value: 0x${hexFromU8([unprotectedFirstByte])})`);
  p.writeUint32(1, chatty && 'QUIC version: 1');

  const endDestConnID = p.writeLengthUint8(chatty && 'destination connection ID');
  p.writeBytes(keys.initialRandom);
  chatty && p.comment('destination connection ID = initial random data');
  endDestConnID();

  const endSourceConnID = p.writeLengthUint8(chatty && 'source connection ID');
  p.writeBytes(sourceConnectionId);
  chatty && p.comment('source connection ID');
  endSourceConnID();

  p.writeQUICInt(0, chatty && 'token length');

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
    const endScid = h.writeLengthUint8('variable-length integer');
    h.writeBytes(sourceConnectionId);
    endScid();

    endExtData();
  });

  endCryptoFrame();
  log(...highlightBytes(cryptoFrame.commentedString(), LogColours.client));

  const cryptoFrameData = cryptoFrame.array();
  const payloadLength = 1 /* packet number */ + cryptoFrameData.length + 16 /* auth tag */;

  const endPacket = p.writeKnownQUICLength(payloadLength, chatty && 'payload');

  const packetNumberStart = p.offset;
  p.writeUint8(0x00, 'packet number, protected (raw value: 0)');
  const packetNumberEnd = p.offset;

  const clientInitialKey = await cs.importKey('raw', keys.clientInitialKeyData, { name: 'AES-GCM' }, false, ['encrypt']);

  const encrypter = new Crypter('encrypt', clientInitialKey, keys.clientInitialIV);
  const initialPacketPrefix = p.data.subarray(0, packetNumberEnd);
  const encryptedPayload = await encrypter.process(cryptoFrameData, 16, initialPacketPrefix);

  p.writeBytes(encryptedPayload.subarray(0, encryptedPayload.length - 16));
  chatty && p.comment('encrypted payload: CRYPTO frame containing the TLS ClientHello');

  p.writeBytes(encryptedPayload.subarray(encryptedPayload.length - 16));
  chatty && p.comment('auth tag');

  endPacket();

  // header protection: 
  // https://datatracker.ietf.org/doc/html/rfc9001#name-header-protection
  // https://datatracker.ietf.org/doc/html/rfc9001#name-sample-packet-protection
  // note that SubtleCrypto has no AEC-ECB, but encrypting a sequence of zeroes using the key as the IV is equivalent here:

  const sampleStart = packetNumberStart + 4;
  const headerProtectionPayloadSample = p.data.subarray(sampleStart, sampleStart + 16);

  const headerProtectionKey = await cs.importKey('raw', keys.clientInitialHPKeyData, { name: 'AES-CBC' }, false, ['encrypt']);
  const headerProtectionBuffer = await cs.encrypt({ name: 'AES-CBC', iv: headerProtectionPayloadSample }, headerProtectionKey, new Uint8Array(16));
  const headerProtectionResult = new Uint8Array(headerProtectionBuffer);

  p.data[0] ^= headerProtectionResult[0] & 0x0f;
  for (let i = packetNumberStart, j = 1; i < packetNumberEnd; i++, j++) {
    p.data[i] ^= headerProtectionResult[j];
  }

  p.skipWrite(1200 - p.offset, chatty && 'padding up to 1200 bytes');
  return p;
}

async function parseServerInitialPacket(keys: Keys, sourceConnectionId: Uint8Array, networkRead: (bytes: number) => Promise<Uint8Array | undefined>) {
  const responsePacket = new QUICBytes(networkRead);
  const protectedServerFirstByte = await responsePacket.readUint8(chatty && 'first byte, protected');
  await responsePacket.expectUint32(0x00000001, chatty && 'QUIC version');

  const [endServerDcid, serverDcidRemaining] = await responsePacket.expectLengthUint8(chatty && 'destination connection ID');
  const serverDcid = await responsePacket.readBytes(serverDcidRemaining());
  chatty && responsePacket.comment('destination connection ID (same as specified by client above)');
  if (!equal(serverDcid, sourceConnectionId)) throw new Error('Connection ID mismatch');
  endServerDcid();

  const [endServerScid, serverScidRemaining] = await responsePacket.expectLengthUint8(chatty && 'source connection ID');
  const serverScid = await responsePacket.readBytes(serverScidRemaining());
  chatty && responsePacket.comment('source connection ID');
  endServerScid();

  await responsePacket.expectUint8(0, chatty && 'token length');

  const [endResponsePayload, responsePayloadRemaining] = await responsePacket.expectQUICLength(chatty && 'payload length');
  const responsePacketNumberStart = responsePacket.offset;

  //const responsePacketNumber = await responsePacket.readUint8(chatty && 'packet number, protected');
  //const responsePacketNumberEnd = responsePacket.offset;

  const encryptedResponsePayload = await responsePacket.readBytes(responsePayloadRemaining() - 16);
  chatty && responsePacket.comment('encrypted payload');
  const encryptedResponseAuthTag = await responsePacket.readBytes(responsePayloadRemaining());
  chatty && responsePacket.comment('auth tag');
  endResponsePayload();

  log(...highlightBytes(responsePacket.commentedString(), LogColours.server));

  // header protection
  const responseSampleStart = responsePacketNumberStart + 4;
  const responseHeaderProtectionPayloadSample = responsePacket.data.subarray(responseSampleStart, responseSampleStart + 16);

  const responseHeaderProtectionKey = await cs.importKey('raw', keys.serverInitialHPKeyData, { name: 'AES-CBC' }, false, ['encrypt']);
  const responseHeaderProtectionBuffer = await cs.encrypt({ name: 'AES-CBC', iv: responseHeaderProtectionPayloadSample }, responseHeaderProtectionKey, new Uint8Array(16));
  const responseHeaderProtectionResult = new Uint8Array(responseHeaderProtectionBuffer);

  const serverFirstByte = responsePacket.data[0] ^= responseHeaderProtectionResult[0] & 0x0f;
  const packetNumberBytes = (serverFirstByte & 0x03) + 1;
  const responsePacketNumberEnd = responsePacketNumberStart + packetNumberBytes;

  for (let i = responsePacketNumberStart, j = 1; i < responsePacketNumberEnd; i++, j++) {
    responsePacket.data[i] ^= responseHeaderProtectionResult[j];
  }

  // decryption

  log(...highlightBytes(responsePacket.commentedString(), LogColours.server));

  const serverInitialKey = await cs.importKey('raw', keys.serverInitialKeyData, { name: 'AES-GCM' }, false, ['decrypt']);

  const decrypter = new Crypter('decrypt', serverInitialKey, keys.serverInitialIV);
  const responsePacketPrefix = responsePacket.data.subarray(0, responsePacketNumberEnd);
  const decryptedPayload = await decrypter.process(concat(encryptedResponsePayload.slice(packetNumberBytes), encryptedResponseAuthTag), 16, responsePacketPrefix);

  log(decryptedPayload);
}

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

  const keys = await getInitialKeys();
  const sourceConnectionId = await getRandomValues(new Uint8Array(5));
  const initialPacket = await makeClientInitialPacket(keys, sourceConnectionId, protocolsForALPN ?? []);

  log(...highlightBytes(initialPacket.commentedString(), LogColours.client));
  networkWrite(initialPacket.array());

  await parseServerInitialPacket(keys, sourceConnectionId, networkRead);
}

const host = 'pgjones.dev';
const { read, write } = await udpTransport(host, 443);

await quicConnect(host, '', read, write, {
  useSNI: true,
  protocolsForALPN: ['h3'],
  requireServerTlsExtKeyUsage: true,
  requireDigitalSigKeyUsage: true,
});
