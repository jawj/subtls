import { TrustedCert, type RootCertsDatabase } from '../tls/cert';
import cs from '../util/cryptoProxy';
import { getRandomValues } from '../util/cryptoRandom';
import { hkdfExtract, hkdfExpandLabel } from '../tls/hkdf';
import { log } from '../presentation/log';
import { highlightColonList } from '../presentation/highlights';
import { hexFromU8, u8FromHex } from '../util/hex';

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

  const clientInitialKey = await hkdfExpandLabel(clientInitialSecret, 'quic key', nullArray, 16, 256);
  chatty && log(...highlightColonList('client initial key: ' + hexFromU8(clientInitialKey)));

  const serverInitialKey = await hkdfExpandLabel(serverInitialSecret, 'quic key', nullArray, 16, 256);
  chatty && log(...highlightColonList('server initial key: ' + hexFromU8(serverInitialKey)));

  const clientInitialIV = await hkdfExpandLabel(clientInitialSecret, 'quic iv', nullArray, 12, 256);
  chatty && log(...highlightColonList('client initial iv: ' + hexFromU8(clientInitialIV)));

  const serverInitialIV = await hkdfExpandLabel(serverInitialSecret, 'quic iv', nullArray, 12, 256);
  chatty && log(...highlightColonList('server initial iv: ' + hexFromU8(serverInitialIV)));

  const clientInitialHPKey = await hkdfExpandLabel(clientInitialSecret, 'quic hp', nullArray, 16, 256);
  chatty && log(...highlightColonList('client initial header protection key: ' + hexFromU8(clientInitialHPKey)));

  const serverInitialHPKey = await hkdfExpandLabel(serverInitialSecret, 'quic hp', nullArray, 16, 256);
  chatty && log(...highlightColonList('server initial header protection key: ' + hexFromU8(serverInitialHPKey)));


  const unprotectedFirstByte = 0b11000000;
  //  1 = long header format
  //  1 = fixed bit, always set
  // 00 =	packet type: initial
  // 00 =	reserved, always unset
  // 00	= length of packet number field, 00 -> 1 byte!


  const ecdhKeys = await cs.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const rawPublicKeyBuffer = await cs.exportKey('raw', ecdhKeys.publicKey);
  const rawPublicKey = new Uint8Array(rawPublicKeyBuffer);

}

quicConnect('example.com', '', async () => new Uint8Array(0), () => { }, {
  useSNI: true,
  protocolsForALPN: ['h2'],
  requireServerTlsExtKeyUsage: true,
  requireDigitalSigKeyUsage: true,
})
  .then(() => {
    console.log('QUIC connection established');
  })
  .catch((error) => {
    console.error('QUIC connection failed:', error);
  });
