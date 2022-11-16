import { equal } from './util/array';
import Bytes from './util/bytes';

export default function parseServerHello(hello: Bytes, sessionId: Uint8Array) {
  let serverPublicKey;
  let tlsVersionSpecified;

  const [endServerHelloMessage] = hello.assertByteCount(hello.remainingBytes());

  hello.expectUint8(0x02, 'handshake type: server hello');
  const helloLength = hello.readUint24('% bytes of server hello follow');
  const [endServerHello] = hello.assertByteCount(helloLength);

  hello.expectUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  const serverRandom = hello.readBytes(32);
  if (equal(serverRandom, [
    // SHA-256 of "HelloRetryRequest", https://datatracker.ietf.org/doc/html/rfc8446#page-32
    // see also: echo -n "HelloRetryRequest" | openssl dgst -sha256 -hex
    0xcf, 0x21, 0xad, 0x74, 0xe5, 0x9a, 0x61, 0x11,
    0xbe, 0x1d, 0x8c, 0x02, 0x1e, 0x65, 0xb8, 0x91,
    0xc2, 0xa2, 0x11, 0x16, 0x7a, 0xbb, 0x8c, 0x5e,
    0x07, 0x9e, 0x09, 0xe2, 0xc8, 0xa8, 0x33, 0x9c
  ])) throw new Error('Unexpected HelloRetryRequest');
  hello.comment('server random — not SHA256("HelloRetryRequest")');

  hello.expectUint8(sessionId.length, 'session ID length (matches client session ID)');
  hello.expectBytes(sessionId, 'session ID (matches client session ID)');

  hello.expectUint16(0x1301, 'cipher (matches client hello)');
  hello.expectUint8(0x00, 'no compression');

  const extensionsLength = hello.readUint16('extensions length');
  const [endExtensions, extensionsRemainingBytes] = hello.assertByteCount(extensionsLength);

  while (extensionsRemainingBytes() > 0) {
    const extensionType = hello.readUint16('extension type');
    const extensionLength = hello.readUint16('extension length');
    const [endExtension] = hello.assertByteCount(extensionLength);

    if (extensionType === 0x002b) {
      if (extensionLength !== 2) throw new Error(`Unexpected extension length: ${extensionLength} (expected 2)`);
      hello.expectUint16(0x0304, 'TLS version 1.3');
      tlsVersionSpecified = true;

    } else if (extensionType === 0x0033) {
      hello.expectUint16(0x0017, 'secp256r1 (NIST P-256) key share');
      hello.expectUint16(65);
      serverPublicKey = hello.readBytes(65);
      // TODO: will SubtleCrypto validate this for us when deriving the shared secret, or must we do it?
      // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2
      // + e.g. https://neilmadden.blog/2017/05/17/so-how-do-you-validate-nist-ecdh-public-keys/
      hello.comment('key');

    } else {
      throw new Error(`Unexpected extension 0x${extensionType.toString(16).padStart(4, '0')}, length ${extensionLength}`)
    }
    endExtension();
  }

  endExtensions();
  endServerHello();
  endServerHelloMessage();

  if (tlsVersionSpecified !== true) throw new Error('No TLS version provided');
  if (serverPublicKey === undefined) throw new Error('No key provided');

  return serverPublicKey;
}