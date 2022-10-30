
import ByteWriter from './bytewriter';

async function startTls(host: string) {
  const hello = new ByteWriter(1024);

  // record header
  hello.writeUint8(0x16);
  hello.comment('record type: handshake');
  hello.writeUint8(0x03, 0x01);
  hello.comment('TLS version 1.0');
  const endRecordHeader = hello.lengthUint16('complete record');

  // handshake header
  hello.writeUint8(0x01);
  hello.comment('handshake type: client hello');
  const endHandshakeHeader = hello.lengthUint24();

  hello.writeUint8(0x03, 0x03);
  hello.comment('TLS 1.2 (for compatibility)');

  crypto.getRandomValues(hello.subarray(32));
  hello.comment('client random');

  const endSessionId = hello.lengthUint8('session ID');
  crypto.getRandomValues(hello.subarray(32));
  hello.comment('session ID');
  endSessionId();

  const endCiphers = hello.lengthUint16('ciphers');
  hello.writeUint8(0x13, 0x01);
  hello.comment('cipher: TLS_AES_128_GCM_SHA256');
  endCiphers();

  const endCompressionMethods = hello.lengthUint8('compression methods');
  hello.writeUint8(0x00);
  hello.comment('compression method: none');
  endCompressionMethods();

  const endExtensions = hello.lengthUint16('extensions');

  hello.writeUint8(0x00, 0x00);
  hello.comment('extension type: SNI');
  const endSNI = hello.lengthUint16('SNI records');
  const endSNIItem = hello.lengthUint16('SNI record');
  hello.writeUint8(0x00);
  hello.comment('list entry type: DNS hostname');
  const endHostname = hello.lengthUint16('hostname');
  hello.writeString(host);
  endHostname();
  endSNIItem();
  endSNI();

  hello.writeUint8(0x00, 0x0b);
  hello.comment('extension type: EC point formats');
  const endFormatTypes = hello.lengthUint16('format types');
  const endFormatTypes2 = hello.lengthUint8('format types');
  hello.writeUint8(0x00);
  hello.comment('format: uncompressed');
  endFormatTypes2();
  endFormatTypes()

  endExtensions();

  endHandshakeHeader();
  endRecordHeader();

  console.log(hello.array());
  console.log(...hello.commentedString());
}

startTls('neon.tech');
