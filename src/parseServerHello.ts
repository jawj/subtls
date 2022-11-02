import Bytes from './util/bytes';

export default function parseServerHello(hello: Bytes) {
  let serverPublicKey;
  let tlsVersionSpecified;

  hello.expectUint8(0x02, 'handshake type: server hello');
  const helloLength = hello.readUint24('server hello length');

  hello.expectUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  hello.skip(32, 'server random');

  hello.expectUint8(0x20, 'session ID length');
  hello.skip(0x20, 'session ID (should match client hello)');

  hello.expectUint16(0x1301, 'cipher (matches client hello)');
  hello.expectUint8(0x00, 'no compression');

  const extensionsLength = hello.readUint16('extensions length');

  while (hello.remainingBytes() > 0) {
    const extensionType = hello.readUint16('extension type');
    const extensionLength = hello.readUint16('extension length');

    if (extensionType === 0x002b) {
      if (extensionLength !== 2) throw new Error(`Unexpected extension length: ${extensionLength} (expected 2)`);
      hello.expectUint16(0x0304, 'TLS version 1.3');
      tlsVersionSpecified = true;

    } else if (extensionType === 0x0033) {
      hello.expectUint16(0x0017, 'secp256r1 (NIST P-256) key share');
      hello.expectUint16(65);
      serverPublicKey = hello.slice(65);
      hello.comment('key');

    } else {
      throw new Error(`Unexpected extension 0x${extensionType.toString(16).padStart(4, '0')}, length ${extensionLength}`)
    }
  }

  if (hello.remainingBytes() !== 0) throw new Error(`Unexpected additional data at end of server hello`);
  if (tlsVersionSpecified !== true || serverPublicKey === undefined) throw new Error(`Incomplete server hello`);

  return serverPublicKey;
}