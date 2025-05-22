import { type RootCertsDatabase } from '../tls/cert';
import cs from '../util/cryptoProxy';
import udpPacketTransport from '../util/udpPacketTransport';

import { getInitialKeys, type InitialKeys } from './keys';
import { log } from '../presentation/log';
import { highlightBytes } from '../presentation/highlights';
import { QUICBytes } from '../util/quicBytes';
import { LogColours } from '../presentation/appearance';
import { getRandomValues } from '../util/cryptoRandom';
import { concat } from '../util/array';
import { ApplicationKeys, getHandshakeKeys, HandshakeKeys } from '../tls/keys';
import { makeClientInitialPacket } from './makeClientInitialPacket';
import { parsePacket } from './parsePacket';
import { parseServerInitialPackets } from './parseServerInitialPackets';

export enum HeaderFormats {
  Short = 0b0,
  Long = 0b1,
}

export enum LongHeaderPacketTypes {
  Initial = 0b00,
  // ZeroRTT = 0b01,
  Handshake = 0b10,
  // Retry = 0b11,
}

export interface KeySets {
  initialKeys?: InitialKeys;
  handshakeKeys?: HandshakeKeys;
  applicationKeys?: ApplicationKeys;
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
  keySets.handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16, true);

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

export const host = 'gridpointgb.uk';  // pgjones.dev
const { read, write, end } = await udpPacketTransport(host, 443);

await quicConnect(host, '', read, write, {
  useSNI: true,
  protocolsForALPN: ['h3'],
  requireServerTlsExtKeyUsage: true,
  requireDigitalSigKeyUsage: true,
});

end();
