
import ByteWriter from './bytewriter';
import highlightCommented from './highlightCommented';

async function startTls(host: string, port: number) {
  const hello = new ByteWriter(1024);

  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true /* extractable */, ['deriveKey', 'deriveBits']);
  const rawPublicKey = await crypto.subtle.exportKey('raw', keys.publicKey);

  hello.writeUint8(0x16);
  hello.comment('record type: handshake');
  hello.writeUint8(0x03, 0x01);
  hello.comment('TLS protocol version 1.0');
  const endRecordHeader = hello.lengthUint16();

  hello.writeUint8(0x01);
  hello.comment('handshake type: client hello');
  const endHandshakeHeader = hello.lengthUint24();

  hello.writeUint8(0x03, 0x03);
  hello.comment('TLS version 1.2 (middlebox compatibility)');

  crypto.getRandomValues(hello.subarray(32));
  hello.comment('client random');

  const endSessionId = hello.lengthUint8('session ID');
  crypto.getRandomValues(hello.subarray(32));
  hello.comment('session ID (middlebox compatibility)');
  endSessionId();

  const endCiphers = hello.lengthUint16('ciphers');
  hello.writeUint8(0x13, 0x01);
  hello.comment('cipher: TLS_AES_128_GCM_SHA256');
  hello.writeUint8(0x00, 0xff);
  hello.comment('cipher: TLS_EMPTY_RENEGOTIATION_INFO_SCSV');
  endCiphers();

  const endCompressionMethods = hello.lengthUint8('compression methods');
  hello.writeUint8(0x00);
  hello.comment('compression method: none');
  endCompressionMethods();

  const endExtensions = hello.lengthUint16('extensions');

  hello.writeUint8(0x00, 0x00);
  hello.comment('extension type: SNI');
  const endSNIExt = hello.lengthUint16('SNI data');
  const endSNI = hello.lengthUint16('SNI records');
  hello.writeUint8(0x00);
  hello.comment('list entry type: DNS hostname');
  const endHostname = hello.lengthUint16('hostname');
  hello.writeString(host);
  endHostname();
  endSNI();
  endSNIExt();

  hello.writeUint8(0x00, 0x0b);
  hello.comment('extension type: EC point formats');
  const endFormatTypesExt = hello.lengthUint16('formats data');
  const endFormatTypes = hello.lengthUint8('formats');
  hello.writeUint8(0x00);
  hello.comment('format: uncompressed');
  endFormatTypes();
  endFormatTypesExt()

  hello.writeUint8(0x00, 0x0a);
  hello.comment('extension type: supported groups (curves)');
  const endGroupsExt = hello.lengthUint16('groups data');
  const endGroups = hello.lengthUint16('groups');
  hello.writeUint8(0x00, 0x17);
  hello.comment('curve secp256r1 (NIST P-256)');
  endGroups();
  endGroupsExt();

  /*
  hello.writeUint8(0x00, 0x23);
  hello.comment('extension type: session ticket');
  const endTicketExt = hello.lengthUint16();
  endTicketExt();

  hello.writeUint8(0x00, 0x16);
  hello.comment('extension type: encrypt-then-MAC');
  const endETMExt = hello.lengthUint16();
  endETMExt();

  hello.writeUint8(0x00, 0x17);
  hello.comment('extension type: extended master secret');
  const endEMSExt = hello.lengthUint16();
  endEMSExt();
  */

  hello.writeUint8(0x00, 0x0d);
  hello.comment('extension type: signature algorithms');
  const endSigsExt = hello.lengthUint16('signature algorithms data');
  const endSigs = hello.lengthUint16('signature algorithms');
  hello.writeUint8(0x04, 0x03);
  hello.comment('ECDSA-SECP256r1-SHA256');
  endSigs();
  endSigsExt();

  hello.writeUint8(0x00, 0x2b);
  hello.comment('extension type: supported TLS versions');
  const endVersionsExt = hello.lengthUint16('TLS versions data');
  const endVersions = hello.lengthUint8('TLS versions');
  hello.writeUint8(0x03, 0x04);
  hello.comment('TLS version 1.3');
  endVersions();
  endVersionsExt();

  /*
  hello.writeUint8(0x00, 0x2d);
  hello.comment('extension type: PSK key-exchange modes');
  const endPSKModesExt = hello.lengthUint16();
  const endPSKModes = hello.lengthUint8();
  hello.writeUint8(0x01);
  hello.comment('PSK with (EC)DHE key establishment');
  endPSKModes();
  endPSKModesExt();
  */

  hello.writeUint8(0x00, 0x33);
  hello.comment('extension type: key share');
  const endKeyShareExt = hello.lengthUint16('key share data');
  const endKeyShares = hello.lengthUint16('key shares');
  hello.writeUint8(0x00, 0x17);
  hello.comment('secp256r1 (NIST P-256) key share');
  const endKeyShare = hello.lengthUint16('key share');
  hello.writeBytes(new Uint8Array(rawPublicKey));
  hello.comment('key');
  endKeyShare();
  endKeyShares();
  endKeyShareExt();

  endExtensions();

  endHandshakeHeader();
  endRecordHeader();

  console.log(...highlightCommented(hello.commentedString(), '#aaa'));

  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('message', msg => console.log(new Uint8Array(msg.data)));
  });

  const bytes = hello.array();
  console.log(bytes);
  ws.send(bytes);
}

startTls('google.com', 443);
