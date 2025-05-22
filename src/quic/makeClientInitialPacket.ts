import { hexFromU8 } from '../export';
import { LogColours } from '../presentation/appearance';
import { highlightBytes } from '../presentation/highlights';
import { log } from '../presentation/log';
import { aesGcmWithXorIv } from '../tls/aesgcm';
import makeClientHello from '../tls/makeClientHello';
import { nullArray } from '../util/array';
import cs from '../util/cryptoProxy';
import { QUICBytes } from '../util/quicBytes';
import { KeySets, host } from './quic';

export async function makeClientInitialPacket(keySets: KeySets, ecdhKeys: CryptoKeyPair, localConnectionId: Uint8Array, protocolsForALPN: string[]) {
  const keys = keySets.initialKeys!;
  const p = new QUICBytes(1200); // we're going to pad it to 1200 bytes anyway

  // https://datatracker.ietf.org/doc/html/rfc9000#packet-initial
  //  1 = long header format
  //  1 = fixed bit, always set
  // 00 =	packet type: initial
  // 00 =	reserved, always unset
  // 00	= length of packet number field - 1, see https://datatracker.ietf.org/doc/html/rfc9000#long-header
  const unprotectedFirstByte = 0b11000000;
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

    h.writeUint8(0x0f, chatty && 'initial_source_connection_id'); // critical, otherwise we get: initial_source_connection_id does not match
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
    xorValue: 0n, // packet number
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
