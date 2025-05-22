import { LogColours } from '../presentation/appearance';
import { highlightBytes } from '../presentation/highlights';
import { log } from '../presentation/log';
import { aesGcmWithXorIv } from '../tls/aesgcm';
import { equal, concat, nullArray } from '../util/array';
import cs from '../util/cryptoProxy';
import { QUICBytes } from '../util/quicBytes';
import { KeySets, HeaderFormats, LongHeaderPacketTypes } from './quic';

export async function parsePacket(keySets: KeySets, sourceConnectionId: Uint8Array, packetRead: () => Promise<Uint8Array | undefined>) {
  const packet = await packetRead();
  const p = new QUICBytes(packet);

  let token = nullArray;

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
      token = await p.readBytes(tokenRemaining());
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

  return { serverConnectionId, headerFormat, packetType, packetNumber, token, decryptedPayload };
}
