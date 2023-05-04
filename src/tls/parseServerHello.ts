import { equal } from '../util/array';
import { Bytes } from '../util/bytes';
import { hexFromU8 } from '../util/hex';

export default function parseServerHello(hello: Bytes, sessionId: Uint8Array) {
  let serverPublicKey;
  let tlsVersionSpecified;

  const [endServerHelloMessage] = hello.expectLength(hello.remaining());

  hello.expectUint8(0x02, chatty && 'handshake type: server hello');
  const [endServerHello] = hello.expectLengthUint24(chatty && 'server hello');

  hello.expectUint16(0x0303, chatty && 'TLS version 1.2 (middlebox compatibility)');
  const serverRandom = hello.readBytes(32);
  if (equal(serverRandom, [
    // SHA-256 of "HelloRetryRequest", https://datatracker.ietf.org/doc/html/rfc8446#page-32
    // see also: echo -n "HelloRetryRequest" | openssl dgst -sha256 -hex
    0xcf, 0x21, 0xad, 0x74, 0xe5, 0x9a, 0x61, 0x11,
    0xbe, 0x1d, 0x8c, 0x02, 0x1e, 0x65, 0xb8, 0x91,
    0xc2, 0xa2, 0x11, 0x16, 0x7a, 0xbb, 0x8c, 0x5e,
    0x07, 0x9e, 0x09, 0xe2, 0xc8, 0xa8, 0x33, 0x9c
  ])) throw new Error('Unexpected HelloRetryRequest');
  chatty && hello.comment('server random — [not SHA256("HelloRetryRequest")](https://datatracker.ietf.org/doc/html/rfc8446#section-4.1.3)');

  hello.expectUint8(sessionId.length, chatty && 'session ID length (matches client session ID)');
  hello.expectBytes(sessionId, chatty && 'session ID (matches client session ID)');

  hello.expectUint16(0x1301, chatty && 'cipher (matches client hello)');
  hello.expectUint8(0x00, chatty && 'no compression');

  const [endExtensions, extensionsRemaining] = hello.expectLengthUint16(chatty && 'extensions');
  while (extensionsRemaining() > 0) {
    const extensionType = hello.readUint16(chatty && 'extension type');
    const [endExtension] = hello.expectLengthUint16(chatty && 'extension');

    if (extensionType === 0x002b) {
      hello.expectUint16(0x0304, chatty && 'TLS version 1.3');
      tlsVersionSpecified = true;

    } else if (extensionType === 0x0033) {
      hello.expectUint16(0x0017, chatty && 'secp256r1 (NIST P-256) key share');
      hello.expectUint16(65);
      serverPublicKey = hello.readBytes(65);
      // TODO: will SubtleCrypto validate this for us when deriving the shared secret, or must we do it?
      // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2
      // + e.g. https://neilmadden.blog/2017/05/17/so-how-do-you-validate-nist-ecdh-public-keys/
      chatty && hello.comment('key');

    } else {
      throw new Error(`Unexpected extension 0x${hexFromU8([extensionType])}`)
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