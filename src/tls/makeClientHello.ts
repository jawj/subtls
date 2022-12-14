import { Bytes } from '../util/bytes';

export default function makeClientHello(host: string, publicKey: ArrayBuffer, sessionId: Uint8Array, useSNI = true) {
  const h = new Bytes(1024);

  h.writeUint8(0x16, chatty && 'record type: handshake');
  h.writeUint16(0x0301, chatty && 'TLS protocol version 1.0');

  const endRecordHeader = h.writeLengthUint16();
  h.writeUint8(0x01, chatty && 'handshake type: client hello');

  const endHandshakeHeader = h.writeLengthUint24();
  h.writeUint16(0x0303, chatty && 'TLS version 1.2 (middlebox compatibility)');

  crypto.getRandomValues(h.subarray(32));
  chatty && h.comment('client random');

  const endSessionId = h.writeLengthUint8(chatty && 'session ID');
  h.writeBytes(sessionId);
  chatty && h.comment('session ID (middlebox compatibility)');
  endSessionId();

  const endCiphers = h.writeLengthUint16(chatty && 'ciphers');
  h.writeUint16(0x1301, chatty && 'cipher: TLS_AES_128_GCM_SHA256');
  endCiphers();

  const endCompressionMethods = h.writeLengthUint8(chatty && 'compression methods');
  h.writeUint8(0x00, chatty && 'compression method: none');
  endCompressionMethods();

  const endExtensions = h.writeLengthUint16(chatty && 'extensions');

  if (useSNI) {
    h.writeUint16(0x0000, chatty && 'extension type: SNI');
    const endSNIExt = h.writeLengthUint16(chatty && 'SNI data');
    const endSNI = h.writeLengthUint16(chatty && 'SNI records');
    h.writeUint8(0x00, chatty && 'list entry type: DNS hostname');
    const endHostname = h.writeLengthUint16(chatty && 'hostname');
    h.writeUTF8String(host);
    endHostname();
    endSNI();
    endSNIExt();
  }

  h.writeUint16(0x000b, chatty && 'extension type: EC point formats');
  const endFormatTypesExt = h.writeLengthUint16(chatty && 'formats data');
  const endFormatTypes = h.writeLengthUint8(chatty && 'formats');
  h.writeUint8(0x00, chatty && 'format: uncompressed');
  endFormatTypes();
  endFormatTypesExt()

  h.writeUint16(0x000a, chatty && 'extension type: supported groups (curves)');
  const endGroupsExt = h.writeLengthUint16(chatty && 'groups data');
  const endGroups = h.writeLengthUint16(chatty && 'groups');
  h.writeUint16(0x0017, chatty && 'curve secp256r1 (NIST P-256)');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7
  endGroups();
  endGroupsExt();

  h.writeUint16(0x000d, chatty && 'extension type: signature algorithms');
  const endSigsExt = h.writeLengthUint16(chatty && 'signature algorithms data');
  const endSigs = h.writeLengthUint16(chatty && 'signature algorithms');
  h.writeUint16(0x0403, chatty && 'ecdsa_secp256r1_sha256');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3
  h.writeUint16(0x0804, chatty && 'rsa_pss_rsae_sha256');
  endSigs();
  endSigsExt();

  h.writeUint16(0x002b, chatty && 'extension type: supported TLS versions');
  const endVersionsExt = h.writeLengthUint16(chatty && 'TLS versions data');
  const endVersions = h.writeLengthUint8(chatty && 'TLS versions');
  h.writeUint16(0x0304, chatty && 'TLS version 1.3');  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.1
  endVersions();
  endVersionsExt();

  h.writeUint16(0x0033, chatty && 'extension type: key share');
  const endKeyShareExt = h.writeLengthUint16(chatty && 'key share data');
  const endKeyShares = h.writeLengthUint16(chatty && 'key shares');
  h.writeUint16(0x0017, chatty && 'secp256r1 (NIST P-256) key share');
  const endKeyShare = h.writeLengthUint16(chatty && 'key share');
  h.writeBytes(new Uint8Array(publicKey));
  chatty && h.comment('key');
  endKeyShare();
  endKeyShares();
  endKeyShareExt();

  endExtensions();

  endHandshakeHeader();
  endRecordHeader();

  return h;
}