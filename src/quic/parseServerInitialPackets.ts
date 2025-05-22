import { LogColours } from '../presentation/appearance';
import { highlightBytes } from '../presentation/highlights';
import { log } from '../presentation/log';
import parseServerHello from '../tls/parseServerHello';
import { nullArray } from '../util/array';
import { QUICBytes } from '../util/quicBytes';
import { parsePacket } from './parsePacket';
import { KeySets } from './quic';

export async function parseServerInitialPackets(keys: KeySets, sourceConnectionId: Uint8Array, packetRead: () => Promise<Uint8Array | undefined>) {
  let serverPublicKey, serverHello;

  while (!serverHello || !serverPublicKey) {
    const { decryptedPayload } = await parsePacket(keys, sourceConnectionId, packetRead);
    const f = new QUICBytes(decryptedPayload);

    while (f.readRemaining() > 0) {
      const frameType = await f.readQUICInt();
      if (frameType === 0) continue; // padding

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
