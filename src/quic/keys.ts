import { hkdfExtract, hkdfExpandLabel } from '../tls/hkdf';
import { getRandomValues } from '../util/cryptoRandom';
import { log } from '../presentation/log';
import { highlightColonList } from '../presentation/highlights';
import { hexFromU8, u8FromHex } from '../util/hex';
import { nullArray } from '../util/array';

export type InitialKeys = Awaited<ReturnType<typeof getInitialKeys>>;

export async function getInitialKeys() {
  const initialRandom = await getRandomValues(new Uint8Array(8));
  chatty && log(...highlightColonList('initial random: ' + hexFromU8(initialRandom)));

  const initialSalt = u8FromHex('38762cf7f55934b34d179ae6a4c80cadccbb7f0a');  // the first SHA-1 collision
  chatty && log(...highlightColonList('initial salt: ' + hexFromU8(initialSalt)));

  const initialSecret = await hkdfExtract(initialSalt, initialRandom, 256);
  chatty && log(...highlightColonList('initial secret: ' + hexFromU8(initialSecret)));

  const clientInitialSecret = await hkdfExpandLabel(initialSecret, 'client in', nullArray, 32, 256);
  chatty && log(...highlightColonList('client initial secret: ' + hexFromU8(clientInitialSecret)));

  const serverInitialSecret = await hkdfExpandLabel(initialSecret, 'server in', nullArray, 32, 256);
  chatty && log(...highlightColonList('server initial secret: ' + hexFromU8(serverInitialSecret)));

  const clientKey = await hkdfExpandLabel(clientInitialSecret, 'quic key', nullArray, 16, 256);
  chatty && log(...highlightColonList('client initial key: ' + hexFromU8(clientKey)));

  const serverKey = await hkdfExpandLabel(serverInitialSecret, 'quic key', nullArray, 16, 256);
  chatty && log(...highlightColonList('server initial key: ' + hexFromU8(serverKey)));

  const clientIV = await hkdfExpandLabel(clientInitialSecret, 'quic iv', nullArray, 12, 256);
  chatty && log(...highlightColonList('client initial iv: ' + hexFromU8(clientIV)));

  const serverIV = await hkdfExpandLabel(serverInitialSecret, 'quic iv', nullArray, 12, 256);
  chatty && log(...highlightColonList('server initial iv: ' + hexFromU8(serverIV)));

  const clientHPKey = await hkdfExpandLabel(clientInitialSecret, 'quic hp', nullArray, 16, 256);
  chatty && log(...highlightColonList('client initial header protection key: ' + hexFromU8(clientHPKey)));

  const serverHPKey = await hkdfExpandLabel(serverInitialSecret, 'quic hp', nullArray, 16, 256);
  chatty && log(...highlightColonList('server initial header protection key: ' + hexFromU8(serverHPKey)));

  return {
    initialRandom,
    clientKey, clientIV, clientHPKey,
    serverKey, serverIV, serverHPKey,
  };
}
