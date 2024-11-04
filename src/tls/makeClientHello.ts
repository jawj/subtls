import { Bytes } from '../util/bytes';

export default function makeClientHello(host: string, publicKey: Uint8Array, sessionId: Uint8Array, useSNI = true) {
  const h = new Bytes(1024);

  h.writeUint8(0x16, chatty && 'record type: handshake');
  h.writeUint16(0x0301, chatty && 'TLS legacy record version 1.0 ([RFC 8446 §5.1](https://datatracker.ietf.org/doc/html/rfc8446#section-5.1))');

  const endRecordHeader = h.writeLengthUint16('TLS record');
  h.writeUint8(0x01, chatty && 'handshake type: client hello');

  const endHandshakeHeader = h.writeLengthUint24();
  h.writeUint16(0x0303, chatty && 'TLS version 1.2 (middlebox compatibility: see [blog.cloudflare.com](https://blog.cloudflare.com/why-tls-1-3-isnt-in-browsers-yet))');

  crypto.getRandomValues(h.subarray(32));
  chatty && h.comment('client random');

  const endSessionId = h.writeLengthUint8(chatty && 'session ID');
  h.writeBytes(sessionId);
  chatty && h.comment('session ID (middlebox compatibility again: [RFC 8446 appendix D4](https://datatracker.ietf.org/doc/html/rfc8446#appendix-D.4))');
  endSessionId();

  const endCiphers = h.writeLengthUint16(chatty && 'ciphers ([RFC 8446 appendix B4](https://datatracker.ietf.org/doc/html/rfc8446#appendix-B.4))');
  h.writeUint16(0x1301, chatty && 'cipher: TLS_AES_128_GCM_SHA256');
  endCiphers();

  const endCompressionMethods = h.writeLengthUint8(chatty && 'compression methods');
  h.writeUint8(0x00, chatty && 'compression method: none');
  endCompressionMethods();

  const endExtensions = h.writeLengthUint16(chatty && 'extensions ([RFC 8446 §4.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2))');

  if (useSNI) {
    h.writeUint16(0x0000, chatty && 'extension type: Server Name Indication, or SNI ([RFC 6066 §3](https://datatracker.ietf.org/doc/html/rfc6066#section-3))');
    const endSNIExt = h.writeLengthUint16(chatty && 'SNI data');
    const endSNI = h.writeLengthUint16(chatty && 'SNI records');
    h.writeUint8(0x00, chatty && 'list entry type: DNS hostname');
    const endHostname = h.writeLengthUint16(chatty && 'hostname');
    h.writeUTF8String(host);
    endHostname();
    endSNI();
    endSNIExt();
  }

  h.writeUint16(0x000b, chatty && 'extension type: supported Elliptic Curve point formats (for middlebox compatibility, from TLS 1.2: [RFC 8422 §5.1.2](https://datatracker.ietf.org/doc/html/rfc8422#section-5.1.2))');
  const endFormatTypesExt = h.writeLengthUint16(chatty && 'point formats data');
  const endFormatTypes = h.writeLengthUint8(chatty && 'point formats');
  h.writeUint8(0x00, chatty && 'point format: uncompressed');
  endFormatTypes();
  endFormatTypesExt()

  h.writeUint16(0x000a, chatty && 'extension type: supported groups for key exchange ([RFC 8446 §4.2.7](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7))');
  const endGroupsExt = h.writeLengthUint16(chatty && 'groups data');
  const endGroups = h.writeLengthUint16(chatty && 'groups');
  h.writeUint16(0x0017, chatty && 'group: elliptic curve secp256r1');
  h.writeUint16(0x001D, chatty && 'group: elliptic curve x25519');
  endGroups();
  endGroupsExt();

  h.writeUint16(0x000d, chatty && 'extension type: signature algorithms ([RFC 8446 §4.2.3](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3))');
  const endSigsExt = h.writeLengthUint16(chatty && 'signature algorithms data');
  const endSigs = h.writeLengthUint16(chatty && 'signature algorithms');
  h.writeUint16(0x0403, chatty && 'algorithm: ecdsa_secp256r1_sha256');
  h.writeUint16(0x0804, chatty && 'algorithm: rsa_pss_rsae_sha256');
  endSigs();
  endSigsExt();

  h.writeUint16(0x002b, chatty && 'extension type: supported TLS versions ([RFC 8446 §4.2.1](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.1))');
  const endVersionsExt = h.writeLengthUint16(chatty && 'TLS versions data');
  const endVersions = h.writeLengthUint8(chatty && 'TLS versions');
  h.writeUint16(0x0304, chatty && 'TLS version: 1.3');
  endVersions();
  endVersionsExt();

  h.writeUint16(0x0033, chatty && 'extension type: key share ([RFC 8446 §4.2.8](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8))');
  const endKeyShareExt = h.writeLengthUint16(chatty && 'key share data');
  const endKeyShares = h.writeLengthUint16(chatty && 'key shares');
  //h.writeUint16(0x0017, chatty && 'secp256r1 (NIST P-256) key share ([RFC 8446 §4.2.7](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7))');
  h.writeUint16(0x001D, chatty && 'X25519 key share ([RFC 8446 §4.2.7](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7))');

  const endKeyShare = h.writeLengthUint16(chatty && 'key share');
  if (chatty) {
    h.writeUint8(publicKey[0], 'legacy point format: always 4, which means uncompressed ([RFC 8446 §4.2.8.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2) and [RFC 8422 §5.4.1](https://datatracker.ietf.org/doc/html/rfc8422#section-5.4.1))');
    h.writeBytes(publicKey.subarray(1, 33));
    h.comment('x coordinate');
    h.writeBytes(publicKey.subarray(33, 65));
    h.comment('y coordinate');

  } else {
    h.writeBytes(publicKey);
  }
  endKeyShare();
  endKeyShares();
  endKeyShareExt();

  endExtensions();

  endHandshakeHeader();
  endRecordHeader();

  return h;
}