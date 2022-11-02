import Bytes from './util/bytes';

export default function makeClientHello(host: string, publicKey: ArrayBuffer) {
  const hello = new Bytes(1024);

  hello.writeUint8(0x16);
  hello.comment('record type: handshake');
  hello.writeUint16(0x0301);
  hello.comment('TLS protocol version 1.0');
  const endRecordHeader = hello.lengthUint16();  // 5 bytes

  hello.writeUint8(0x01);
  hello.comment('handshake type: client hello');
  const endHandshakeHeader = hello.lengthUint24();

  hello.writeUint16(0x0303);
  hello.comment('TLS version 1.2 (middlebox compatibility)');

  crypto.getRandomValues(hello.subarray(32));
  hello.comment('client random');

  const endSessionId = hello.lengthUint8('session ID');
  crypto.getRandomValues(hello.subarray(32));
  hello.comment('session ID (middlebox compatibility)');
  endSessionId();

  const endCiphers = hello.lengthUint16('ciphers');
  hello.writeUint16(0x1301);
  hello.comment('cipher: TLS_AES_128_GCM_SHA256');
  // hello.writeUint16(0x00ff);
  // hello.comment('cipher: TLS_EMPTY_RENEGOTIATION_INFO_SCSV');
  endCiphers();

  const endCompressionMethods = hello.lengthUint8('compression methods');
  hello.writeUint8(0x00);
  hello.comment('compression method: none');
  endCompressionMethods();

  const endExtensions = hello.lengthUint16('extensions');

  hello.writeUint16(0x0000);
  hello.comment('extension type: SNI');
  const endSNIExt = hello.lengthUint16('SNI data');
  const endSNI = hello.lengthUint16('SNI records');
  hello.writeUint8(0x00);
  hello.comment('list entry type: DNS hostname');
  const endHostname = hello.lengthUint16('hostname');
  hello.writeUTF8String(host);
  endHostname();
  endSNI();
  endSNIExt();

  hello.writeUint16(0x000b);
  hello.comment('extension type: EC point formats');
  const endFormatTypesExt = hello.lengthUint16('formats data');
  const endFormatTypes = hello.lengthUint8('formats');
  hello.writeUint8(0x00);
  hello.comment('format: uncompressed');
  endFormatTypes();
  endFormatTypesExt()

  hello.writeUint16(0x000a);
  hello.comment('extension type: supported groups (curves)');
  const endGroupsExt = hello.lengthUint16('groups data');
  const endGroups = hello.lengthUint16('groups');
  hello.writeUint16(0x0017);
  hello.comment('curve secp256r1 (NIST P-256)');
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

  hello.writeUint16(0x000d);
  hello.comment('extension type: signature algorithms');
  const endSigsExt = hello.lengthUint16('signature algorithms data');
  const endSigs = hello.lengthUint16('signature algorithms');
  hello.writeUint16(0x0403);
  hello.comment('ECDSA-SECP256r1-SHA256');
  endSigs();
  endSigsExt();

  hello.writeUint16(0x002b);
  hello.comment('extension type: supported TLS versions');
  const endVersionsExt = hello.lengthUint16('TLS versions data');
  const endVersions = hello.lengthUint8('TLS versions');
  hello.writeUint16(0x0304);
  hello.comment('TLS version 1.3');
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

  hello.writeUint16(0x0033);
  hello.comment('extension type: key share');
  const endKeyShareExt = hello.lengthUint16('key share data');
  const endKeyShares = hello.lengthUint16('key shares');
  hello.writeUint16(0x0017);
  hello.comment('secp256r1 (NIST P-256) key share');
  const endKeyShare = hello.lengthUint16('key share');
  hello.writeBytes(new Uint8Array(publicKey));
  hello.comment('key');
  endKeyShare();
  endKeyShares();
  endKeyShareExt();

  endExtensions();

  endHandshakeHeader();
  endRecordHeader();

  return hello;
}