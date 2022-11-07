import Bytes from './util/bytes';

export default function makeClientHello(host: string, publicKey: ArrayBuffer) {
  const h = new Bytes(1024);

  h.writeUint8(0x16);
  h.comment('record type: handshake');
  h.writeUint16(0x0301);
  h.comment('TLS protocol version 1.0');
  const endRecordHeader = h.lengthUint16();  // 5 bytes

  h.writeUint8(0x01);
  h.comment('handshake type: client hello');
  const endHandshakeHeader = h.lengthUint24();

  h.writeUint16(0x0303);
  h.comment('TLS version 1.2 (middlebox compatibility)');

  crypto.getRandomValues(h.subarray(32));
  h.comment('client random');

  const endSessionId = h.lengthUint8('session ID');
  const sessionId = h.subarray(32);
  crypto.getRandomValues(sessionId);
  h.comment('session ID (middlebox compatibility)');
  endSessionId();

  const endCiphers = h.lengthUint16('ciphers');
  h.writeUint16(0x1301);
  h.comment('cipher: TLS_AES_128_GCM_SHA256');
  // hello.writeUint16(0x00ff);
  // hello.comment('cipher: TLS_EMPTY_RENEGOTIATION_INFO_SCSV');
  endCiphers();

  const endCompressionMethods = h.lengthUint8('compression methods');
  h.writeUint8(0x00);
  h.comment('compression method: none');
  endCompressionMethods();

  const endExtensions = h.lengthUint16('extensions');

  h.writeUint16(0x0000);
  h.comment('extension type: SNI');
  const endSNIExt = h.lengthUint16('SNI data');
  const endSNI = h.lengthUint16('SNI records');
  h.writeUint8(0x00);
  h.comment('list entry type: DNS hostname');
  const endHostname = h.lengthUint16('hostname');
  h.writeUTF8String(host);
  endHostname();
  endSNI();
  endSNIExt();

  h.writeUint16(0x000b);
  h.comment('extension type: EC point formats');
  const endFormatTypesExt = h.lengthUint16('formats data');
  const endFormatTypes = h.lengthUint8('formats');
  h.writeUint8(0x00);
  h.comment('format: uncompressed');
  endFormatTypes();
  endFormatTypesExt()

  h.writeUint16(0x000a);
  h.comment('extension type: supported groups (curves)');
  const endGroupsExt = h.lengthUint16('groups data');
  const endGroups = h.lengthUint16('groups');
  h.writeUint16(0x0017);  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7
  h.comment('curve secp256r1 (NIST P-256)');
  endGroups();
  endGroupsExt();

  // hello.writeUint16(0x0023);
  // hello.comment('extension type: session ticket');
  // const endTicketExt = hello.lengthUint16();
  // endTicketExt();

  // hello.writeUint16(0x0016);
  // hello.comment('extension type: encrypt-then-MAC');
  // const endETMExt = hello.lengthUint16();
  // endETMExt();

  // hello.writeUint16(0x0017);
  // hello.comment('extension type: extended master secret');
  // const endEMSExt = hello.lengthUint16();
  // endEMSExt();

  h.writeUint16(0x000d);
  h.comment('extension type: signature algorithms');
  const endSigsExt = h.lengthUint16('signature algorithms data');
  const endSigs = h.lengthUint16('signature algorithms');
  h.writeUint16(0x0403);  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3
  h.comment('ECDSA-SECP256r1-SHA256');
  endSigs();
  endSigsExt();

  h.writeUint16(0x002b);
  h.comment('extension type: supported TLS versions');
  const endVersionsExt = h.lengthUint16('TLS versions data');
  const endVersions = h.lengthUint8('TLS versions');
  h.writeUint16(0x0304);  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.1
  h.comment('TLS version 1.3');
  endVersions();
  endVersionsExt();

  // hello.writeUint16(0x002d);
  // hello.comment('extension type: PSK key-exchange modes');
  // const endPSKModesExt = hello.lengthUint16();
  // const endPSKModes = hello.lengthUint8();
  // hello.writeUint8(0x01);
  // hello.comment('PSK with (EC)DHE key establishment');
  // endPSKModes();
  // endPSKModesExt();

  h.writeUint16(0x0033);
  h.comment('extension type: key share');
  const endKeyShareExt = h.lengthUint16('key share data');
  const endKeyShares = h.lengthUint16('key shares');
  h.writeUint16(0x0017);
  h.comment('secp256r1 (NIST P-256) key share');
  const endKeyShare = h.lengthUint16('key share');
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