import { hexFromU8 } from '../util/hex';
import { log } from '../presentation/log';
import { highlightColonList } from '../presentation/highlights';
import cs from '../util/cryptoProxy';
import { hkdfExtract, hkdfExpandLabel } from './hkdf';
import { nullArray } from '../util/array';

export async function getHandshakeKeys(serverPublicKey: Uint8Array, privateKey: CryptoKey, hellos: Uint8Array, hashBits: 256 | 384, keyLength: 16 | 32, quic = false) {  // keyLength: 16 for AES128, 32 for AES256
  const hashBytes = hashBits >>> 3;
  const zeroKey = new Uint8Array(hashBytes);

  const publicKey = await cs.importKey('raw', serverPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false /* extractable */, []);
  const sharedSecretBuffer = await cs.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  chatty && log(...highlightColonList('shared secret (via ECDH): ' + hexFromU8(sharedSecret)));

  const hellosHashBuffer = await cs.digest('SHA-256', hellos);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  chatty && log(...highlightColonList('hellos hash: ' + hexFromU8(hellosHash)));

  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashBits);
  chatty && log(...highlightColonList('early secret: ' + hexFromU8(new Uint8Array(earlySecret))));

  const emptyHashBuffer = await cs.digest(`SHA-${hashBits}`, nullArray);
  const emptyHash = new Uint8Array(emptyHashBuffer);
  chatty && log(...highlightColonList('empty hash: ' + hexFromU8(emptyHash)));

  const derivedSecret = await hkdfExpandLabel(earlySecret, 'derived', emptyHash, hashBytes, hashBits);
  chatty && log(...highlightColonList('derived secret: ' + hexFromU8(derivedSecret)));

  const masterSecret = await hkdfExtract(derivedSecret, sharedSecret, hashBits);
  chatty && log(...highlightColonList('handshake secret: ' + hexFromU8(masterSecret)));

  const clientSecret = await hkdfExpandLabel(masterSecret, 'c hs traffic', hellosHash, hashBytes, hashBits);
  chatty && log(...highlightColonList('client secret: ' + hexFromU8(clientSecret)));

  const serverSecret = await hkdfExpandLabel(masterSecret, 's hs traffic', hellosHash, hashBytes, hashBits);
  chatty && log(...highlightColonList('server secret: ' + hexFromU8(serverSecret)));

  const clientKey = await hkdfExpandLabel(clientSecret, quic ? 'quic key' : 'key', nullArray, keyLength, hashBits);
  chatty && log(...highlightColonList('client handshake key: ' + hexFromU8(clientKey)));

  const serverKey = await hkdfExpandLabel(serverSecret, quic ? 'quic key' : 'key', nullArray, keyLength, hashBits);
  chatty && log(...highlightColonList('server handshake key: ' + hexFromU8(serverKey)));

  const clientIV = await hkdfExpandLabel(clientSecret, quic ? 'quic iv' : 'iv', nullArray, 12, hashBits);
  chatty && log(...highlightColonList('client handshake iv: ' + hexFromU8(clientIV)));

  const serverIV = await hkdfExpandLabel(serverSecret, quic ? 'quic iv' : 'iv', nullArray, 12, hashBits);
  chatty && log(...highlightColonList('server handshake iv: ' + hexFromU8(serverIV)));

  const clientHPKey = quic ? await hkdfExpandLabel(clientSecret, 'quic hp', nullArray, keyLength, hashBits) : nullArray;
  chatty && quic && log(...highlightColonList('client handshake header protection key: ' + hexFromU8(clientHPKey)));

  const serverHPKey = quic ? await hkdfExpandLabel(serverSecret, 'quic hp', nullArray, keyLength, hashBits) : nullArray;
  chatty && quic && log(...highlightColonList('server handshake header protection key: ' + hexFromU8(serverHPKey)));

  return { masterSecret, clientSecret, clientKey, clientIV, clientHPKey, serverSecret, serverKey, serverIV, serverHPKey };
}

export async function getApplicationKeys(handshakeSecret: Uint8Array, handshakeHash: Uint8Array, hashBits: 256 | 384, keyLength: 16 | 32) {  // keyLength: 16 for ASE128, 32 for AES256
  const hashBytes = hashBits >>> 3;
  const zeroKey = new Uint8Array(hashBytes);

  const emptyHashBuffer = await cs.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  chatty && log(...highlightColonList('empty hash: ' + hexFromU8(emptyHash)));

  const derivedSecret = await hkdfExpandLabel(handshakeSecret, 'derived', emptyHash, hashBytes, hashBits);
  chatty && log(...highlightColonList('derived secret: ' + hexFromU8(derivedSecret)));

  const masterSecret = await hkdfExtract(derivedSecret, zeroKey, hashBits);
  chatty && log(...highlightColonList('master secret: ' + hexFromU8(masterSecret)));

  const clientSecret = await hkdfExpandLabel(masterSecret, 'c ap traffic', handshakeHash, hashBytes, hashBits);
  chatty && log(...highlightColonList('client secret: ' + hexFromU8(clientSecret)));

  const serverSecret = await hkdfExpandLabel(masterSecret, 's ap traffic', handshakeHash, hashBytes, hashBits);
  chatty && log(...highlightColonList('server secret: ' + hexFromU8(serverSecret)));

  const clientKey = await hkdfExpandLabel(clientSecret, 'key', nullArray, keyLength, hashBits);
  chatty && log(...highlightColonList('client application key: ' + hexFromU8(clientKey)));

  const serverKey = await hkdfExpandLabel(serverSecret, 'key', nullArray, keyLength, hashBits);
  chatty && log(...highlightColonList('server application key: ' + hexFromU8(serverKey)));

  const clientIV = await hkdfExpandLabel(clientSecret, 'iv', nullArray, 12, hashBits);
  chatty && log(...highlightColonList('client application iv: ' + hexFromU8(clientIV)));

  const serverIV = await hkdfExpandLabel(serverSecret, 'iv', nullArray, 12, hashBits);
  chatty && log(...highlightColonList('server application iv: ' + hexFromU8(serverIV)));

  return { serverKey, serverIV, clientKey, clientIV };
}
