import { type RootCertsDatabase } from '../tls/cert';
import cs from '../util/cryptoProxy';

import { getInitialKeys, type InitialKeys } from './keys';
import { log } from '../presentation/log';
import { highlightBytes } from '../presentation/highlights';
import { hexFromU8 } from '../util/hex';
import { QUICBytes } from '../util/quicBytes';
import { LogColours } from '../presentation/appearance';
import udpPacketTransport from '../util/udpPacketTransport';
import makeClientHello from '../tls/makeClientHello';
import { getRandomValues } from '../util/cryptoRandom';
import { concat, equal } from '../util/array';
import { aesGcmWithXorIv } from '../tls/aesgcm';
import parseServerHello from '../tls/parseServerHello';
import { nullArray } from '../util/array';
import { ApplicationKeys, getHandshakeKeys, HandshakeKeys } from '../tls/keys';

enum HeaderFormats {
  Short = 0b0,
  Long = 0b1,
}

enum LongHeaderPacketTypes {
  Initial = 0b00,
  // ZeroRTT = 0b01,
  Handshake = 0b10,
  // Retry = 0b11,
}

interface KeySets {
  initialKeys?: InitialKeys;
  handshakeKeys?: HandshakeKeys;
  applicationKeys?: ApplicationKeys;
}

async function makeClientInitialPacket(keySets: KeySets, ecdhKeys: CryptoKeyPair, localConnectionId: Uint8Array, protocolsForALPN: string[]) {
  const keys = keySets.initialKeys!;
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
  p.writeBytes(localConnectionId);
  chatty && p.comment('source connection ID');
  endSourceConnID();

  p.writeQUICInt(0, chatty && 'token length');

  const cryptoFrame = new QUICBytes();
  cryptoFrame.writeUint8(0x06, 'frame type: CRYPTO');
  cryptoFrame.writeQUICInt(0x00, 'offset of this CRYPTO stream data');
  const endCryptoFrame = cryptoFrame.writeQUICLength('TLS ClientHello'); // NB. offset is not advanced!

  const rawPublicKeyBuffer = await cs.exportKey('raw', ecdhKeys.publicKey);
  const rawPublicKey = new Uint8Array(rawPublicKeyBuffer);

  const almostClientHelloStart = cryptoFrame.offset;
  await makeClientHello(cryptoFrame, host, rawPublicKey, nullArray, true, protocolsForALPN, h => {
    h.writeUint16(0x0039, chatty && 'extension type: QUIC transport parameters');
    const endExtData = h.writeLengthUint16(chatty && 'transport parameter data');

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
    h.writeBytes(localConnectionId);
    endScid();

    endExtData();
  });

  const cryptoFrameLengthBytes = endCryptoFrame();
  log(...highlightBytes(cryptoFrame.commentedString(), LogColours.client));

  const cryptoFrameData = cryptoFrame.array();
  const clientHelloStart = almostClientHelloStart + cryptoFrameLengthBytes;
  const clientHello = cryptoFrameData.subarray(clientHelloStart);
  const payloadLength = 1 /* packet number */ + cryptoFrameData.length + 16 /* auth tag */;

  const endPacket = p.writeKnownQUICLength(payloadLength, chatty && 'payload');

  const packetNumberStart = p.offset;
  p.writeUint8(0x00, 'packet number, protected (raw value: 0)');
  const packetNumberEnd = p.offset;

  const initialPacketPrefix = p.data.subarray(0, packetNumberEnd);
  const encryptedPayload = await aesGcmWithXorIv('encrypt', {
    data: cryptoFrameData,
    key: keys.clientKey,
    iv: keys.clientIV,
    xorValue: 0n,  // packet number
    additionalData: initialPacketPrefix,
    authTagByteLength: 16,
  });

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

  const headerProtectionKey = await cs.importKey('raw', keys.clientHPKey, { name: 'AES-CBC' }, false, ['encrypt']);
  const headerProtectionBuffer = await cs.encrypt({ name: 'AES-CBC', iv: headerProtectionPayloadSample }, headerProtectionKey, new Uint8Array(16));
  const headerProtectionResult = new Uint8Array(headerProtectionBuffer);

  p.data[0] ^= headerProtectionResult[0] & 0x0f;
  for (let i = packetNumberStart, j = 1; i < packetNumberEnd; i++, j++) {
    p.data[i] ^= headerProtectionResult[j];
  }

  p.skipWrite(1200 - p.offset, chatty && 'padding up to 1200 bytes');

  log(...highlightBytes(p.commentedString(), LogColours.client));
  return { clientInitialPacket: p, clientHello };
}

async function parsePacket(keySets: KeySets, sourceConnectionId: Uint8Array, packetRead: () => Promise<Uint8Array | undefined>) {
  const packet = await packetRead();
  const p = new QUICBytes(packet);

  const firstByte = await p.readUint8(chatty && 'first byte, unprotected (protected value: 0x%)');
  const headerFormat: HeaderFormats = firstByte >>> 7;
  if (headerFormat !== HeaderFormats.Long) throw new Error('At present only long headers are supported');
  const packetType: LongHeaderPacketTypes = (firstByte >>> 4) & 0b11;

  const keys = {
    [LongHeaderPacketTypes.Initial]: keySets.initialKeys,
    [LongHeaderPacketTypes.Handshake]: keySets.handshakeKeys,
  }[packetType]!;

  // can't parse the last 4 bits yet, since they're protected

  await p.expectUint32(0x00000001, chatty && 'QUIC version');

  const [endDcid, dcidRemaining] = await p.expectLengthUint8(chatty && 'destination connection ID');
  const dcid = await p.readBytes(dcidRemaining());
  chatty && p.comment('destination connection ID (same as specified by client above)');
  if (!equal(dcid, sourceConnectionId)) throw new Error('Connection ID mismatch');
  endDcid();

  const [endScid, scidRemaining] = await p.expectLengthUint8(chatty && 'source connection ID');
  const serverConnectionId = await p.readBytes(scidRemaining());
  chatty && p.comment('source connection ID');
  endScid();

  if (packetType === LongHeaderPacketTypes.Initial) {
    const [endToken, tokenRemaining] = await p.expectQUICLength(chatty && 'token length');
    if (tokenRemaining() > 0) {
      const token = await p.readBytes(tokenRemaining());
      chatty && p.comment('token');
    }
    endToken();
  }

  const [endPayload, payloadRemaining] = await p.expectQUICLength(chatty && 'payload length');
  const packetNumberStart = p.offset;

  const packetNumberPlusEncryptedPayload = await p.readBytes(payloadRemaining() - 16);
  chatty && p.comment('encrypted payload');
  const encryptedAuthTag = await p.readBytes(payloadRemaining());
  chatty && p.comment('auth tag');
  const packetEnd = p.offset;
  endPayload();

  // header protection
  const sampleStart = packetNumberStart + 4;
  const headerProtectionSample = p.data.subarray(sampleStart, sampleStart + 16);

  const headerProtectionKey = await cs.importKey('raw', keys.serverHPKey, { name: 'AES-CBC' }, false, ['encrypt']);
  const headerProtectionBuffer = await cs.encrypt({ name: 'AES-CBC', iv: headerProtectionSample }, headerProtectionKey, new Uint8Array(16));
  const headerProtectionResult = new Uint8Array(headerProtectionBuffer);

  const serverFirstByte = p.data[0] ^= headerProtectionResult[0] & 0x0f;
  const packetNumberBytes = (serverFirstByte & 0x03) + 1;

  p.offset = packetNumberStart;
  const readBits = ([8, 16, 24, 32] as const)[packetNumberBytes - 1];
  await p.readUintN(readBits, chatty && 'packet number, unprotected (protected value: 0x%)');
  const packetNumberEnd = p.offset;

  for (let i = packetNumberStart, j = 1; i < packetNumberEnd; i++, j++) {
    p.data[i] ^= headerProtectionResult[j];
  }

  p.offset -= packetNumberBytes;
  const packetNumber = await p.readUintN(readBits);

  p.offset = packetEnd;
  const remaining = p.readRemaining();
  if (remaining > 0) await p.skipRead(remaining, chatty && 'padding');

  log(...highlightBytes(p.commentedString(), LogColours.server));

  // decryption
  const packetPrefix = p.data.subarray(0, packetNumberEnd);
  const encryptedPayload = packetNumberPlusEncryptedPayload.subarray(packetNumberBytes);

  const decryptedPayload = await aesGcmWithXorIv('decrypt', {
    data: concat(encryptedPayload, encryptedAuthTag),
    key: keys.serverKey,
    iv: keys.serverIV,
    xorValue: BigInt(packetNumber),
    additionalData: packetPrefix,
    authTagByteLength: 16,
  });

  return { serverConnectionId, headerFormat, packetType, packetNumber, decryptedPayload };
}

async function parseServerInitialPackets(keys: KeySets, sourceConnectionId: Uint8Array, packetRead: () => Promise<Uint8Array | undefined>) {
  let serverPublicKey, serverHello;

  while (!serverHello) {
    const { decryptedPayload } = await parsePacket(keys, sourceConnectionId, packetRead);
    const f = new QUICBytes(decryptedPayload);

    while (f.readRemaining() > 0) {
      const frameType = await f.readQUICInt();
      if (frameType === 0) continue;  // padding

      if (frameType === 0x02 || frameType === 0x03) {
        chatty && f.comment('frame type: ACK');
        const largestAcked = await f.readQUICInt(chatty && 'largest packet number acknowledged');
        const ackDelay = await f.readQUICInt(chatty && 'acknowledgment delay (undecoded): %');
        let rangeCount = await f.readQUICInt(chatty && 'number of additional ACK ranges that will follow the first ACK range: %');
        const firstAckRange = await f.readQUICInt(chatty && 'first ACK range: %');
        while (rangeCount-- > 0) {
          const ackGap = await f.readQUICInt(chatty && 'ACK range gap: %');
          const ackLength = await f.readQUICInt(chatty && 'ACK range length: %');
        }

        if (frameType === 0x03) {
          const ect0Count = await f.readQUICInt(chatty && 'ECT0 count: %');
          const ect1Count = await f.readQUICInt(chatty && 'ECT1 count: %');
          const ecnceCount = await f.readQUICInt(chatty && 'ECN-CE count: %');
        }


      } else if (frameType === 0x06) {
        chatty && f.comment('frame type: CRYPTO');
        const offset = await f.readQUICInt(chatty && 'byte offset in stream');
        const [endCryptoData] = await f.expectQUICLength(chatty && 'stream data');
        const serverHelloStart = f.offset;
        serverPublicKey = await parseServerHello(f, nullArray);
        serverHello = f.data.subarray(serverHelloStart, f.offset);
        endCryptoData();
      }
    }

    log(...highlightBytes(f.commentedString(), LogColours.server));
  }
  return { serverPublicKey, serverHello };
}

export async function quicConnect(
  host: string,
  rootCertsDatabase: RootCertsDatabase | string,
  packetRead: () => Promise<Uint8Array | undefined>,
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

  const keySets: KeySets = {};

  // QUIC initial keys
  keySets.initialKeys = await getInitialKeys();
  const localConnectionId = await getRandomValues(new Uint8Array(5));

  // TLS keys
  const ecdhKeys = await cs.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);

  const { clientInitialPacket, clientHello } = await makeClientInitialPacket(keySets, ecdhKeys, localConnectionId, protocolsForALPN ?? []);
  networkWrite(clientInitialPacket.array());

  const { serverPublicKey, serverHello } = await parseServerInitialPackets(keySets, localConnectionId, packetRead);

  // handshake keys + encryption/decryption instances
  chatty && log('Both sides of the exchange now have everything they need to calculate the keys and IVs that will protect the rest of the handshake:');
  chatty && log('%c%s', `color: ${LogColours.header}`, 'handshake key computations ([source](https://github.com/jawj/subtls/blob/main/src/tls/keys.ts))');

  const hellos = concat(clientHello, serverHello);
  keySets.handshakeKeys = await getHandshakeKeys(serverPublicKey!, ecdhKeys.privateKey, hellos, 256, 16, true);

  // next packet
  while (true) {
    const { headerFormat, packetType, decryptedPayload } = await parsePacket(keySets, localConnectionId, packetRead);

    if (headerFormat === HeaderFormats.Long && packetType === LongHeaderPacketTypes.Handshake) {
      const f = new QUICBytes(decryptedPayload);

      while (f.readRemaining() > 0) {
        const frameType = await f.readQUICInt();
        if (frameType === 0) continue;  // padding

        if (frameType === 0x06) {
          chatty && f.comment('frame type: CRYPTO');
          const offset = await f.readQUICInt(chatty && 'byte offset in stream: %');
          const [endCryptoData, cryptoDataRemaining] = await f.expectQUICLength(chatty && 'stream data');

          await f.readBytes(cryptoDataRemaining());
          log(...highlightBytes(f.commentedString(), LogColours.server));

          endCryptoData();
        }
      }

    } else {
      log({ headerFormat, packetType, decryptedPayload });
    }
  }
}

const host = 'gridpointgb.uk';
const { read, write, end } = await udpPacketTransport(host, 443);

await quicConnect(host, '', read, write, {
  useSNI: true,
  protocolsForALPN: ['h3'],
  requireServerTlsExtKeyUsage: true,
  requireDigitalSigKeyUsage: true,
});

end();
