import Bytes from '../util/bytes';

export default function makeClientHello(host: string, publicKey: ArrayBuffer) {
  const h = new Bytes(1024);

  h.writeUint8(0x16);
  h.comment('record type: handshake');
  h.writeUint16(0x0301);
  h.comment('TLS protocol version 1.0');
  const endRecordHeader = h.writeLengthUint16();

  h.writeUint8(0x01);
  h.comment('handshake type: client hello');
  const endHandshakeHeader = h.writeLengthUint24();

  h.writeUint16(0x0303);
  h.comment('TLS version 1.2 (middlebox compatibility)');

  crypto.getRandomValues(h.subarray(32));
  h.comment('client random');

  const endSessionId = h.writeLengthUint8('session ID');
  const sessionId = h.subarray(32);
  crypto.getRandomValues(sessionId);
  h.comment('session ID (middlebox compatibility)');
  endSessionId();

  const endCiphers = h.writeLengthUint16('ciphers');
  h.writeUint16(0x1301);
  h.comment('cipher: TLS_AES_128_GCM_SHA256');
  endCiphers();

  const endCompressionMethods = h.writeLengthUint8('compression methods');
  h.writeUint8(0x00);
  h.comment('compression method: none');
  endCompressionMethods();

  const endExtensions = h.writeLengthUint16('extensions');

  h.writeUint16(0x0000);
  h.comment('extension type: SNI');
  const endSNIExt = h.writeLengthUint16('SNI data');
  const endSNI = h.writeLengthUint16('SNI records');
  h.writeUint8(0x00);
  h.comment('list entry type: DNS hostname');
  const endHostname = h.writeLengthUint16('hostname');
  h.writeUTF8String(host);
  endHostname();
  endSNI();
  endSNIExt();

  h.writeUint16(0x000b);
  h.comment('extension type: EC point formats');
  const endFormatTypesExt = h.writeLengthUint16('formats data');
  const endFormatTypes = h.writeLengthUint8('formats');
  h.writeUint8(0x00);
  h.comment('format: uncompressed');
  endFormatTypes();
  endFormatTypesExt()

  h.writeUint16(0x000a);
  h.comment('extension type: supported groups (curves)');
  const endGroupsExt = h.writeLengthUint16('groups data');
  const endGroups = h.writeLengthUint16('groups');
  h.writeUint16(0x0017);  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7
  h.comment('curve secp256r1 (NIST P-256)');
  endGroups();
  endGroupsExt();

  h.writeUint16(0x000d);
  h.comment('extension type: signature algorithms');
  const endSigsExt = h.writeLengthUint16('signature algorithms data');
  const endSigs = h.writeLengthUint16('signature algorithms');
  h.writeUint16(0x0403);  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3
  h.comment('ECDSA-SECP256r1-SHA256');
  endSigs();
  endSigsExt();

  h.writeUint16(0x002b);
  h.comment('extension type: supported TLS versions');
  const endVersionsExt = h.writeLengthUint16('TLS versions data');
  const endVersions = h.writeLengthUint8('TLS versions');
  h.writeUint16(0x0304);  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.1
  h.comment('TLS version 1.3');
  endVersions();
  endVersionsExt();

  h.writeUint16(0x0033);
  h.comment('extension type: key share');
  const endKeyShareExt = h.writeLengthUint16('key share data');
  const endKeyShares = h.writeLengthUint16('key shares');
  h.writeUint16(0x0017);
  h.comment('secp256r1 (NIST P-256) key share');
  const endKeyShare = h.writeLengthUint16('key share');
  h.writeBytes(new Uint8Array(publicKey));
  h.comment('key');
  endKeyShare();
  endKeyShares();
  endKeyShareExt();

  endExtensions();

  endHandshakeHeader();
  endRecordHeader();

  return { clientHello: h, sessionId };
}