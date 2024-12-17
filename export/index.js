var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true,
writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/util/array.ts
function concat(...arrs) {
  if (arrs.length === 1 && arrs[0] instanceof Uint8Array) return arrs[0];
  const length = arrs.reduce((memo, arr) => memo + arr.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const arr of arrs) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
function equal(a, b) {
  const aLength = a.length;
  if (aLength !== b.length) return false;
  for (let i = 0; i < aLength; i++) if (a[i] !== b[i]) return false;
  return true;
}
var GrowableData = class {
  constructor() {
    __publicField(this, "length");
    __publicField(this, "data");
    this.length = 0;
    this.data = new Uint8Array();
  }
  append(newData) {
    const newDataLength = newData.length;
    if (this.length + newDataLength > this.data.length) {
      const prevData = this.data;
      this.data = new Uint8Array(this.length * 2 + newDataLength);
      this.data.set(prevData);
    }
    this.data.set(newData, this.length);
    this.length += newData.length;
  }
  getData() {
    return this.data.subarray(0, this.length);
  }
};

// src/presentation/appearance.ts
var indentChars = "\xB7\xB7 ";

// src/util/bytes.ts
var txtEnc = new TextEncoder();
var txtDec = new TextDecoder();
var Bytes = class {
  constructor(arrayOrMaxBytes) {
    __publicField(this, "offset");
    __publicField(this, "dataView");
    __publicField(this, "data");
    __publicField(this, "comments");
    __publicField(this, "indents");
    __publicField(this, "indent");
    this.offset = 0;
    this.data = typeof arrayOrMaxBytes === "number" ? new Uint8Array(arrayOrMaxBytes) : arrayOrMaxBytes;
    this.dataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    this.comments = {};
    this.indents = {};
    this.indent = 0;
  }
  extend(arrayOrMaxBytes) {
    const newData = typeof arrayOrMaxBytes === "number" ? new Uint8Array(arrayOrMaxBytes) : arrayOrMaxBytes;
    this.data = concat(this.data, newData);
    this.dataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }
  remaining() {
    return this.data.length - this.offset;
  }
  subarray(length) {
    return this.data.subarray(this.offset, this.offset += length);
  }
  skip(length, comment) {
    this.offset += length;
    if (comment) this.comment(comment);
    return this;
  }
  comment(s, offset = this.offset) {
    if (true) throw new Error("No comments should be emitted outside of chatty mode");
    const existing = this.comments[offset];
    const result = (existing === void 0 ? "" : existing + " ") + s;
    this.comments[offset] = result;
    return this;
  }
  lengthComment(length, comment, inclusive = false) {
    return length === 1 ? `${length} byte${comment ? ` of ${comment}` : ""} ${inclusive ? "starts here" : "fol\
lows"}` : `${length === 0 ? "no" : length} bytes${comment ? ` of ${comment}` : ""} ${inclusive ? "start here" :
    "follow"}`;
  }
  // reading
  readBytes(length) {
    return this.data.slice(this.offset, this.offset += length);
  }
  readUTF8String(length) {
    const bytes = this.subarray(length);
    const s = txtDec.decode(bytes);
    return s;
  }
  readUTF8StringNullTerminated() {
    let endOffset = this.offset;
    while (this.data[endOffset] !== 0) endOffset++;
    const str = this.readUTF8String(endOffset - this.offset);
    this.expectUint8(0, "end of string");
    return str;
  }
  readUint8(comment) {
    const result = this.dataView.getUint8(this.offset);
    this.offset += 1;
    if (0) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  readUint16(comment) {
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    if (0) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  readUint24(comment) {
    const msb = this.readUint8();
    const lsbs = this.readUint16();
    const result = (msb << 16) + lsbs;
    if (0) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  readUint32(comment) {
    const result = this.dataView.getUint32(this.offset);
    this.offset += 4;
    if (0) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  expectBytes(expected, comment) {
    const actual = this.readBytes(expected.length);
    if (0) this.comment(comment);
    if (!equal(actual, expected)) throw new Error(`Unexpected bytes`);
  }
  expectUint8(expectedValue, comment) {
    const actualValue = this.readUint8();
    if (0) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectUint16(expectedValue, comment) {
    const actualValue = this.readUint16();
    if (0) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectUint24(expectedValue, comment) {
    const actualValue = this.readUint24();
    if (0) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectUint32(expectedValue, comment) {
    const actualValue = this.readUint32();
    if (0) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectLength(length, indentDelta = 1) {
    const startOffset = this.offset;
    const endOffset = startOffset + length;
    if (endOffset > this.data.length) throw new Error("Expected length exceeds remaining data length");
    this.indent += indentDelta;
    this.indents[startOffset] = this.indent;
    return [
      () => {
        this.indent -= indentDelta;
        this.indents[this.offset] = this.indent;
        if (this.offset !== endOffset) throw new Error(`${length} bytes expected but ${this.offset - startOffset}\
 read`);
      },
      () => endOffset - this.offset
    ];
  }
  expectLengthUint8(comment) {
    const length = this.readUint8();
    return this.expectLength(length);
  }
  expectLengthUint16(comment) {
    const length = this.readUint16();
    return this.expectLength(length);
  }
  expectLengthUint24(comment) {
    const length = this.readUint24();
    return this.expectLength(length);
  }
  expectLengthUint32(comment) {
    const length = this.readUint32();
    return this.expectLength(length);
  }
  expectLengthUint8Incl(comment) {
    const length = this.readUint8();
    return this.expectLength(length - 1);
  }
  expectLengthUint16Incl(comment) {
    const length = this.readUint16();
    return this.expectLength(length - 2);
  }
  expectLengthUint24Incl(comment) {
    const length = this.readUint24();
    return this.expectLength(length - 3);
  }
  expectLengthUint32Incl(comment) {
    const length = this.readUint32();
    return this.expectLength(length - 4);
  }
  // writing
  writeBytes(bytes) {
    this.data.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }
  writeUTF8String(s) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    return this;
  }
  writeUTF8StringNullTerminated(s) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    this.writeUint8(0);
    return this;
  }
  writeUint8(value, comment) {
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
    if (0) this.comment(comment);
    return this;
  }
  writeUint16(value, comment) {
    this.dataView.setUint16(this.offset, value);
    this.offset += 2;
    if (0) this.comment(comment);
    return this;
  }
  writeUint24(value, comment) {
    this.writeUint8((value & 16711680) >> 16);
    this.writeUint16(value & 65535, comment);
    return this;
  }
  writeUint32(value, comment) {
    this.dataView.setUint32(this.offset, value);
    this.offset += 4;
    if (0) this.comment(comment);
    return this;
  }
  // forward-looking lengths
  _writeLengthGeneric(lengthBytes, inclusive, comment) {
    const startOffset = this.offset;
    this.offset += lengthBytes;
    const endOffset = this.offset;
    this.indent += 1;
    this.indents[endOffset] = this.indent;
    return () => {
      const length = this.offset - (inclusive ? startOffset : endOffset);
      if (lengthBytes === 1) this.dataView.setUint8(startOffset, length);
      else if (lengthBytes === 2) this.dataView.setUint16(startOffset, length);
      else if (lengthBytes === 3) {
        this.dataView.setUint8(startOffset, (length & 16711680) >> 16);
        this.dataView.setUint16(startOffset + 1, length & 65535);
      } else if (lengthBytes === 4) this.dataView.setUint32(startOffset, length);
      else throw new Error(`Invalid length for length field: ${lengthBytes}`);
      this.indent -= 1;
      this.indents[this.offset] = this.indent;
    };
  }
  writeLengthUint8(comment) {
    return this._writeLengthGeneric(1, false, comment);
  }
  writeLengthUint16(comment) {
    return this._writeLengthGeneric(2, false, comment);
  }
  writeLengthUint24(comment) {
    return this._writeLengthGeneric(3, false, comment);
  }
  writeLengthUint32(comment) {
    return this._writeLengthGeneric(4, false, comment);
  }
  writeLengthUint8Incl(comment) {
    return this._writeLengthGeneric(1, true, comment);
  }
  writeLengthUint16Incl(comment) {
    return this._writeLengthGeneric(2, true, comment);
  }
  writeLengthUint24Incl(comment) {
    return this._writeLengthGeneric(3, true, comment);
  }
  writeLengthUint32Incl(comment) {
    return this._writeLengthGeneric(4, true, comment);
  }
  // output
  array() {
    return this.data.subarray(0, this.offset);
  }
  commentedString(all = false) {
    let s = this.indents[0] !== void 0 ? indentChars.repeat(this.indents[0]) : "";
    let indent = this.indents[0] ?? 0;
    const len = all ? this.data.length : this.offset;
    for (let i = 0; i < len; i++) {
      s += this.data[i].toString(16).padStart(2, "0") + " ";
      const comment = this.comments[i + 1];
      if (this.indents[i + 1] !== void 0) indent = this.indents[i + 1];
      if (comment) s += ` ${comment}
${indentChars.repeat(indent)}`;
    }
    return s;
  }
};

// src/tls/makeClientHello.ts
function makeClientHello(host, publicKey, sessionId, useSNI = true) {
  const h = new Bytes(1024);
  h.writeUint8(22, 0);
  h.writeUint16(769, 0);
  const endRecordHeader = h.writeLengthUint16("TLS record");
  h.writeUint8(1, 0);
  const endHandshakeHeader = h.writeLengthUint24();
  h.writeUint16(771, 0);
  crypto.getRandomValues(h.subarray(32));
  const endSessionId = h.writeLengthUint8(0);
  h.writeBytes(sessionId);
  endSessionId();
  const endCiphers = h.writeLengthUint16(0);
  h.writeUint16(4865, 0);
  endCiphers();
  const endCompressionMethods = h.writeLengthUint8(0);
  h.writeUint8(0, 0);
  endCompressionMethods();
  const endExtensions = h.writeLengthUint16(0);
  if (useSNI) {
    h.writeUint16(0, 0);
    const endSNIExt = h.writeLengthUint16(0);
    const endSNI = h.writeLengthUint16(0);
    h.writeUint8(0, 0);
    const endHostname = h.writeLengthUint16(0);
    h.writeUTF8String(host);
    endHostname();
    endSNI();
    endSNIExt();
  }
  h.writeUint16(11, 0);
  const endFormatTypesExt = h.writeLengthUint16(0);
  const endFormatTypes = h.writeLengthUint8(0);
  h.writeUint8(0, 0);
  endFormatTypes();
  endFormatTypesExt();
  h.writeUint16(10, 0);
  const endGroupsExt = h.writeLengthUint16(0);
  const endGroups = h.writeLengthUint16(0);
  h.writeUint16(23, 0);
  endGroups();
  endGroupsExt();
  h.writeUint16(13, 0);
  const endSigsExt = h.writeLengthUint16(0);
  const endSigs = h.writeLengthUint16(0);
  h.writeUint16(1027, 0);
  h.writeUint16(2052, 0);
  endSigs();
  endSigsExt();
  h.writeUint16(43, 0);
  const endVersionsExt = h.writeLengthUint16(0);
  const endVersions = h.writeLengthUint8(0);
  h.writeUint16(772, 0);
  endVersions();
  endVersionsExt();
  h.writeUint16(51, 0);
  const endKeyShareExt = h.writeLengthUint16(0);
  const endKeyShares = h.writeLengthUint16(0);
  h.writeUint16(23, 0);
  const endKeyShare = h.writeLengthUint16(0);
  if (0) {
    h.writeUint8(publicKey[0], "legacy point format: always 4, which means uncompressed ([RFC 8446 \xA74.2.8.2](h\
ttps://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2) and [RFC 8422 \xA75.4.1](https://datatracker.ietf.o\
rg/doc/html/rfc8422#section-5.4.1))");
    h.writeBytes(publicKey.subarray(1, 33));
    h.comment("x coordinate");
    h.writeBytes(publicKey.subarray(33, 65));
    h.comment("y coordinate");
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

// src/util/hex.ts
function u8FromHex(hex) {
  return new Uint8Array(Array.from(hex.matchAll(/[0-9a-f]/g)).map((hex2) => parseInt(hex2[0], 16)));
}
function hexFromU8(u8, spacer = "") {
  return [...u8].map((n) => n.toString(16).padStart(2, "0")).join(spacer);
}

// src/tls/parseServerHello.ts
function parseServerHello(h, sessionId) {
  let serverPublicKey;
  let tlsVersionSpecified;
  const [endServerHelloMessage] = h.expectLength(h.remaining());
  h.expectUint8(2, 0);
  const [endServerHello] = h.expectLengthUint24(0);
  h.expectUint16(771, 0);
  const serverRandom = h.readBytes(32);
  if (equal(serverRandom, [
    // SHA-256 of "HelloRetryRequest", https://datatracker.ietf.org/doc/html/rfc8446#page-32
    // see also: echo -n "HelloRetryRequest" | openssl dgst -sha256 -hex
    207,
    33,
    173,
    116,
    229,
    154,
    97,
    17,
    190,
    29,
    140,
    2,
    30,
    101,
    184,
    145,
    194,
    162,
    17,
    22,
    122,
    187,
    140,
    94,
    7,
    158,
    9,
    226,
    200,
    168,
    51,
    156
  ])) throw new Error("Unexpected HelloRetryRequest");
  h.expectUint8(sessionId.length, 0);
  h.expectBytes(sessionId, 0);
  h.expectUint16(4865, 0);
  h.expectUint8(0, 0);
  const [endExtensions, extensionsRemaining] = h.expectLengthUint16(0);
  while (extensionsRemaining() > 0) {
    const extensionType = h.readUint16(0);
    const [endExtension] = h.expectLengthUint16(0);
    if (extensionType === 43) {
      h.expectUint16(772, 0);
      tlsVersionSpecified = true;
    } else if (extensionType === 51) {
      h.expectUint16(23, 0);
      const [endKeyShare, keyShareRemaining] = h.expectLengthUint16("key share");
      const keyShareLength = keyShareRemaining();
      if (keyShareLength !== 65) throw new Error(`Expected 65 bytes of key share, but got ${keyShareLength}`);
      if (0) {
        h.expectUint8(4, "legacy point format: always 4, which means uncompressed ([RFC 8446 \xA74.2.8.2](https:/\
/datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2) and [RFC 8422 \xA75.4.1](https://datatracker.ietf.org/doc\
/html/rfc8422#section-5.4.1))");
        const x = h.readBytes(32);
        h.comment("x coordinate");
        const y = h.readBytes(32);
        h.comment("y coordinate");
        serverPublicKey = concat2([4], x, y);
      } else {
        serverPublicKey = h.readBytes(keyShareLength);
      }
      endKeyShare();
    } else {
      throw new Error(`Unexpected extension 0x${hexFromU8([extensionType])}`);
    }
    endExtension();
  }
  endExtensions();
  endServerHello();
  endServerHelloMessage();
  if (tlsVersionSpecified !== true) throw new Error("No TLS version provided");
  if (serverPublicKey === void 0) throw new Error("No key provided");
  return serverPublicKey;
}

// src/presentation/highlights.ts
var regex = new RegExp(`  .+|^(${indentChars})+`, "gm");

// src/tls/sessionTicket.ts
function parseSessionTicket(record) {
  if (0) {
    const ticket = new Bytes2(record);
    ticket.expectUint8(4, "session ticket message ([RFC 8846 \xA74.6.1](https://datatracker.ietf.org/doc/html/rfc\
8446#section-4.6.1))");
    const [endTicketRecord] = ticket.expectLengthUint24("session ticket message");
    const ticketSeconds = ticket.readUint32();
    ticket.comment(`ticket lifetime in seconds: ${ticketSeconds} = ${ticketSeconds / 3600} hours`);
    ticket.readUint32("ticket age add");
    const [endTicketNonce, ticketNonceRemaining] = ticket.expectLengthUint8("ticket nonce");
    ticket.readBytes(ticketNonceRemaining());
    ticket.comment("ticket nonce");
    endTicketNonce();
    const [endTicket, ticketRemaining] = ticket.expectLengthUint16("ticket");
    ticket.readBytes(ticketRemaining());
    ticket.comment("ticket");
    endTicket();
    const [endTicketExts, ticketExtsRemaining] = ticket.expectLengthUint16("ticket extensions");
    if (ticketExtsRemaining() > 0) {
      ticket.readBytes(ticketExtsRemaining());
      ticket.comment("ticket extensions (ignored)");
    }
    endTicketExts();
    endTicketRecord();
    log(...highlightBytes(ticket.commentedString(), LogColours.server));
  }
}

// src/tls/tlsRecord.ts
var maxPlaintextRecordLength = 1 << 14;
var maxCiphertextRecordLength = maxPlaintextRecordLength + 1 + 255;
async function readTlsRecord(read, expectedType, maxLength = maxPlaintextRecordLength) {
  const headerLength = 5;
  const headerData = await read(headerLength);
  if (headerData === void 0) return;
  if (headerData.length < headerLength) throw new Error("TLS record header truncated");
  const header = new Bytes(headerData);
  const type = header.readUint8();
  if (type < 20 || type > 24) throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  if (expectedType !== void 0 && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(
  16).padStart(2, "0")} (expected 0x${expectedType.toString(16).padStart(2, "0")})`);
  header.expectUint16(771, "TLS record version 1.2 (middlebox compatibility)");
  const length = header.readUint16();
  if (length > maxLength) throw new Error(`Record too long: ${length} bytes`);
  const content = await read(length);
  if (content === void 0 || content.length < length) throw new Error("TLS record content truncated");
  return { headerData, header, type, length, content };
}
async function readEncryptedTlsRecord(read, decrypter, expectedType) {
  const encryptedRecord = await readTlsRecord(read, 23 /* Application */, maxCiphertextRecordLength);
  if (encryptedRecord === void 0) return;
  const encryptedBytes = new Bytes(encryptedRecord.content);
  const [endEncrypted] = encryptedBytes.expectLength(encryptedBytes.remaining());
  encryptedBytes.skip(encryptedRecord.length - 16, 0);
  encryptedBytes.skip(16, 0);
  endEncrypted();
  const decryptedRecord = await decrypter.process(encryptedRecord.content, 16, encryptedRecord.headerData);
  let recordTypeIndex = decryptedRecord.length - 1;
  while (decryptedRecord[recordTypeIndex] === 0) recordTypeIndex -= 1;
  if (recordTypeIndex < 0) throw new Error("Decrypted message has no record type indicator (all zeroes)");
  const type = decryptedRecord[recordTypeIndex];
  const record = decryptedRecord.subarray(
    0,
    recordTypeIndex
    /* exclusive */
  );
  if (type === 21 /* Alert */) {
    const closeNotify = record.length === 2 && record[0] === 1 && record[1] === 0;
    if (closeNotify) return void 0;
  }
  if (type === 22 /* Handshake */ && record[0] === 4) {
    parseSessionTicket(record);
    return readEncryptedTlsRecord(read, decrypter, expectedType);
  }
  if (expectedType !== void 0 && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(
  16).padStart(2, "0")} (expected 0x${expectedType.toString(16).padStart(2, "0")})`);
  return record;
}
async function makeEncryptedTlsRecord(plaintext, encrypter, type) {
  const data = concat(plaintext, [type]);
  const headerLength = 5;
  const dataLength = data.length;
  const authTagLength = 16;
  const payloadLength = dataLength + authTagLength;
  const encryptedRecord = new Bytes(headerLength + payloadLength);
  encryptedRecord.writeUint8(23, 0);
  encryptedRecord.writeUint16(771, 0);
  encryptedRecord.writeUint16(payloadLength, `${payloadLength} bytes follow`);
  const [endEncryptedRecord] = encryptedRecord.expectLength(payloadLength);
  const header = encryptedRecord.array();
  const encryptedData = await encrypter.process(data, 16, header);
  encryptedRecord.writeBytes(encryptedData.subarray(0, encryptedData.length - 16));
  encryptedRecord.writeBytes(encryptedData.subarray(encryptedData.length - 16));
  endEncryptedRecord();
  return encryptedRecord.array();
}
async function makeEncryptedTlsRecords(plaintext, encrypter, type) {
  const recordCount = Math.ceil(plaintext.length / maxPlaintextRecordLength);
  const encryptedRecords = [];
  for (let i = 0; i < recordCount; i++) {
    const data = plaintext.subarray(i * maxPlaintextRecordLength, (i + 1) * maxPlaintextRecordLength);
    const encryptedRecord = await makeEncryptedTlsRecord(data, encrypter, type);
    encryptedRecords.push(encryptedRecord);
  }
  return encryptedRecords;
}

// src/util/cryptoProxy.ts
var cryptoProxy_default = crypto.subtle;

// src/tls/hkdf.ts
var txtEnc2 = new TextEncoder();
async function hkdfExtract(salt, keyMaterial, hashBits) {
  const hmacKey = await cryptoProxy_default.importKey("raw", salt, { name: "HMAC", hash: { name: `SHA-${hashBits}` } },
  false, ["sign"]);
  var prk = new Uint8Array(await cryptoProxy_default.sign("HMAC", hmacKey, keyMaterial));
  return prk;
}
async function hkdfExpand(key, info, length, hashBits) {
  const hashBytes = hashBits >> 3;
  const n = Math.ceil(length / hashBytes);
  const okm = new Uint8Array(n * hashBytes);
  const hmacKey = await cryptoProxy_default.importKey("raw", key, { name: "HMAC", hash: { name: `SHA-${hashBits}` } },
  false, ["sign"]);
  let tPrev = new Uint8Array(0);
  for (let i = 0; i < n; i++) {
    const hmacData = concat(tPrev, info, [i + 1]);
    const tiBuffer = await cryptoProxy_default.sign("HMAC", hmacKey, hmacData);
    const ti = new Uint8Array(tiBuffer);
    okm.set(ti, hashBytes * i);
    tPrev = ti;
  }
  return okm.subarray(0, length);
}
var tls13_Bytes = txtEnc2.encode("tls13 ");
async function hkdfExpandLabel(key, label, context, length, hashBits) {
  const labelData = txtEnc2.encode(label);
  const hkdfLabel = concat(
    [(length & 65280) >> 8, length & 255],
    [tls13_Bytes.length + labelData.length],
    tls13_Bytes,
    labelData,
    [context.length],
    context
  );
  return hkdfExpand(key, hkdfLabel, length, hashBits);
}

// src/tls/keys.ts
async function getHandshakeKeys(serverPublicKey, privateKey, hellos, hashBits, keyLength) {
  const hashBytes = hashBits >>> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const publicKey = await cryptoProxy_default.importKey("raw", serverPublicKey, { name: "ECDH", namedCurve: "P\
-256" }, false, []);
  const sharedSecretBuffer = await cryptoProxy_default.deriveBits({ name: "ECDH", public: publicKey }, privateKey,
  256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  const hellosHashBuffer = await cryptoProxy_default.digest("SHA-256", hellos);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashBits);
  const emptyHashBuffer = await cryptoProxy_default.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  const derivedSecret = await hkdfExpandLabel(earlySecret, "derived", emptyHash, hashBytes, hashBits);
  const handshakeSecret = await hkdfExtract(derivedSecret, sharedSecret, hashBits);
  const clientSecret = await hkdfExpandLabel(handshakeSecret, "c hs traffic", hellosHash, hashBytes, hashBits);
  const serverSecret = await hkdfExpandLabel(handshakeSecret, "s hs traffic", hellosHash, hashBytes, hashBits);
  const clientHandshakeKey = await hkdfExpandLabel(clientSecret, "key", new Uint8Array(0), keyLength, hashBits);
  const serverHandshakeKey = await hkdfExpandLabel(serverSecret, "key", new Uint8Array(0), keyLength, hashBits);
  const clientHandshakeIV = await hkdfExpandLabel(clientSecret, "iv", new Uint8Array(0), 12, hashBits);
  const serverHandshakeIV = await hkdfExpandLabel(serverSecret, "iv", new Uint8Array(0), 12, hashBits);
  return { serverHandshakeKey, serverHandshakeIV, clientHandshakeKey, clientHandshakeIV, handshakeSecret, clientSecret,
  serverSecret };
}
async function getApplicationKeys(handshakeSecret, handshakeHash, hashBits, keyLength) {
  const hashBytes = hashBits >>> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const emptyHashBuffer = await cryptoProxy_default.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  const derivedSecret = await hkdfExpandLabel(handshakeSecret, "derived", emptyHash, hashBytes, hashBits);
  const masterSecret = await hkdfExtract(derivedSecret, zeroKey, hashBits);
  const clientSecret = await hkdfExpandLabel(masterSecret, "c ap traffic", handshakeHash, hashBytes, hashBits);
  const serverSecret = await hkdfExpandLabel(masterSecret, "s ap traffic", handshakeHash, hashBytes, hashBits);
  const clientApplicationKey = await hkdfExpandLabel(clientSecret, "key", new Uint8Array(0), keyLength, hashBits);
  const serverApplicationKey = await hkdfExpandLabel(serverSecret, "key", new Uint8Array(0), keyLength, hashBits);
  const clientApplicationIV = await hkdfExpandLabel(clientSecret, "iv", new Uint8Array(0), 12, hashBits);
  const serverApplicationIV = await hkdfExpandLabel(serverSecret, "iv", new Uint8Array(0), 12, hashBits);
  return { serverApplicationKey, serverApplicationIV, clientApplicationKey, clientApplicationIV };
}

// src/tls/aesgcm.ts
var Crypter = class {
  constructor(mode, key, initialIv) {
    this.mode = mode;
    this.key = key;
    this.initialIv = initialIv;
    __publicField(this, "recordsProcessed", 0n);
    __publicField(this, "priorPromise", Promise.resolve(new Uint8Array()));
  }
  // The `Promise`s returned by successive calls to this function always resolve in sequence,
  // which is not true for `processUnsequenced` in Node (even if it seems to be in browsers)
  async process(data, authTagLength, additionalData) {
    return this.sequence(this.processUnsequenced(data, authTagLength, additionalData));
  }
  async sequence(promise) {
    const sequenced = this.priorPromise.then(() => promise);
    this.priorPromise = sequenced;
    return sequenced;
  }
  // data is plainText for encrypt, concat(ciphertext, authTag) for decrypt
  async processUnsequenced(data, authTagByteLength, additionalData) {
    const recordIndex = this.recordsProcessed;
    this.recordsProcessed += 1n;
    const iv = this.initialIv.slice();
    const ivLength = BigInt(iv.length);
    const lastIndex = ivLength - 1n;
    for (let i = 0n; i < ivLength; i++) {
      const shifted = recordIndex >> (i << 3n);
      if (shifted === 0n) break;
      iv[Number(lastIndex - i)] ^= Number(shifted & 0xffn);
    }
    const authTagBitLength = authTagByteLength << 3;
    const algorithm = { name: "AES-GCM", iv, tagLength: authTagBitLength, additionalData };
    const resultBuffer = await cryptoProxy_default[this.mode](algorithm, this.key, data);
    const result = new Uint8Array(resultBuffer);
    return result;
  }
};

// src/util/base64.ts
function base64Error(charCode) {
  throw new Error(`Invalid base 64 character: ${String.fromCharCode(charCode)}`);
}
function stdCharCodes(charCode) {
  return charCode > 64 && charCode < 91 ? charCode - 65 : charCode > 96 && charCode < 123 ? charCode - 71 : charCode >
  47 && charCode < 58 ? charCode + 4 : charCode === 43 ? 62 : charCode === 47 ? 63 : charCode === 61 ? 64 : base64Error(
  charCode);
}
function base64Decode(input, charCodes = stdCharCodes, autoPad = true) {
  const len = input.length;
  if (autoPad) input += "=".repeat(len % 4);
  let inputIdx = 0, outputIdx = 0;
  let enc1 = 64, enc2 = 64, enc3 = 64, enc4 = 64;
  const output = new Uint8Array(len * 0.75);
  while (inputIdx < len) {
    enc1 = charCodes(input.charCodeAt(inputIdx++));
    enc2 = charCodes(input.charCodeAt(inputIdx++));
    enc3 = charCodes(input.charCodeAt(inputIdx++));
    enc4 = charCodes(input.charCodeAt(inputIdx++));
    output[outputIdx++] = enc1 << 2 | enc2 >> 4;
    output[outputIdx++] = (enc2 & 15) << 4 | enc3 >> 2;
    output[outputIdx++] = (enc3 & 3) << 6 | enc4;
  }
  const excessLength = enc2 === 64 ? 0 : (
    // implies zero-length input
    enc3 === 64 ? 2 : enc4 === 64 ? 1 : 0
  );
  return output.subarray(0, outputIdx - excessLength);
}

// src/util/asn1bytes.ts
var ASN1Bytes = class extends Bytes {
  readASN1Length(comment) {
    const byte1 = this.readUint8();
    if (byte1 < 128) {
      return byte1;
    }
    const lengthBytes = byte1 & 127;
    const fullComment = 0;
    if (lengthBytes === 1) return this.readUint8(fullComment);
    if (lengthBytes === 2) return this.readUint16(fullComment);
    if (lengthBytes === 3) return this.readUint24(fullComment);
    if (lengthBytes === 4) return this.readUint32(fullComment);
    throw new Error(`ASN.1 length fields are only supported up to 4 bytes (this one is ${lengthBytes} bytes)`);
  }
  expectASN1Length(comment) {
    const length = this.readASN1Length(comment);
    return this.expectLength(length);
  }
  readASN1OID(comment) {
    const [endOID, OIDRemaining] = this.expectASN1Length(0);
    const byte1 = this.readUint8();
    let oid = `${Math.floor(byte1 / 40)}.${byte1 % 40}`;
    while (OIDRemaining() > 0) {
      let value = 0;
      while (true) {
        const nextByte = this.readUint8();
        value <<= 7;
        value += nextByte & 127;
        if (nextByte < 128) break;
      }
      oid += `.${value}`;
    }
    if (0) this.comment(comment.replace(/%/g, oid));
    endOID();
    return oid;
  }
  readASN1Boolean(comment) {
    const [endBoolean, booleanRemaining] = this.expectASN1Length(0);
    const length = booleanRemaining();
    if (length !== 1) throw new Error(`Boolean has weird length: ${length}`);
    const byte = this.readUint8();
    let result;
    if (byte === 255) result = true;
    else if (byte === 0) result = false;
    else throw new Error(`Boolean has weird value: 0x${hexFromU8([byte])}`);
    if (0) this.comment(comment.replace(/%/g, String(result)));
    endBoolean();
    return result;
  }
  readASN1UTCTime() {
    const [endTime, timeRemaining] = this.expectASN1Length(0);
    const timeStr = this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
    if (!parts) throw new Error("Unrecognised ASN.1 UTC time format");
    const [, yr2dstr, mth, dy, hr, min, sec] = parts;
    const yr2d = parseInt(yr2dstr, 10);
    const yr = yr2d + (yr2d >= 50 ? 1900 : 2e3);
    const time = /* @__PURE__ */ new Date(`${yr}-${mth}-${dy}T${hr}:${min}:${sec}Z`);
    endTime();
    return time;
  }
  readASN1GeneralizedTime() {
    const [endTime, timeRemaining] = this.expectASN1Length(0);
    const timeStr = this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})?([0-9]{2})?([.][0-9]+)?(Z)?([-+][0-9]+)?$/);
    if (!parts) throw new Error("Unrecognised ASN.1 generalized time format");
    const [, yr, mth, dy, hr, min, sec, fracsec, z, tz] = parts;
    if (sec === void 0 && fracsec !== void 0) throw new Error("Invalid ASN.1 generalized time format (fraction\
 without seconds)");
    if (z !== void 0 && tz !== void 0) throw new Error("Invalid ASN.1 generalized time format (Z and timezone)");
    const time = /* @__PURE__ */ new Date(`${yr}-${mth}-${dy}T${hr}:${min ?? "00"}:${sec ?? "00"}${fracsec ?? ""}${tz ??
    "Z"}`);
    endTime();
    return time;
  }
  readASN1BitString() {
    const [endBitString, bitStringRemaining] = this.expectASN1Length(0);
    const rightPadBits = this.readUint8(0);
    const bytesLength = bitStringRemaining();
    const bitString = this.readBytes(bytesLength);
    if (rightPadBits > 7) throw new Error(`Invalid right pad value: ${rightPadBits}`);
    if (rightPadBits > 0) {
      const leftPadNext = 8 - rightPadBits;
      for (let i = bytesLength - 1; i > 0; i--) {
        bitString[i] = 255 & bitString[i - 1] << leftPadNext | bitString[i] >>> rightPadBits;
      }
      bitString[0] = bitString[0] >>> rightPadBits;
    }
    endBitString();
    return bitString;
  }
};

// src/tls/certUtils.ts
var universalTypeBoolean = 1;
var universalTypeInteger = 2;
var constructedUniversalTypeSequence = 48;
var constructedUniversalTypeSet = 49;
var universalTypeOID = 6;
var universalTypePrintableString = 19;
var universalTypeTeletexString = 20;
var universalTypeUTF8String = 12;
var universalTypeIA5String = 22;
var universalTypeUTCTime = 23;
var universalTypeGeneralizedTime = 24;
var universalTypeNull = 5;
var universalTypeOctetString = 4;
var universalTypeBitString = 3;
var constructedContextSpecificType = 163;
var contextSpecificType = 128;
var DNOIDMap = {
  "2.5.4.6": "C",
  // country
  "2.5.4.10": "O",
  // organisation
  "2.5.4.11": "OU",
  // organisational unit
  "2.5.4.3": "CN",
  // common name
  "2.5.4.7": "L",
  // locality
  "2.5.4.8": "ST",
  // state/province
  "2.5.4.12": "T",
  // title
  "2.5.4.42": "GN",
  // given name
  "2.5.4.43": "I",
  // initials
  "2.5.4.4": "SN",
  // surname
  "1.2.840.113549.1.9.1": "MAIL",
  "2.5.4.5": "SERIALNUMBER"
};
function intFromBitString(bs) {
  const { length } = bs;
  if (length > 4) throw new Error(`Bit string length ${length} would overflow JS bit operators`);
  let result = 0;
  let leftShift = 0;
  for (let i = bs.length - 1; i >= 0; i--) {
    result |= bs[i] << leftShift;
    leftShift += 8;
  }
  return result;
}
function readSeqOfSetOfSeq(cb, seqType) {
  const result = {};
  cb.expectUint8(constructedUniversalTypeSequence, 0);
  const [endSeq, seqRemaining] = cb.expectASN1Length(0);
  while (seqRemaining() > 0) {
    cb.expectUint8(constructedUniversalTypeSet, 0);
    const [endItemSet] = cb.expectASN1Length(0);
    cb.expectUint8(constructedUniversalTypeSequence, 0);
    const [endItemSeq] = cb.expectASN1Length(0);
    cb.expectUint8(universalTypeOID, 0);
    const itemOID = cb.readASN1OID();
    const itemName = DNOIDMap[itemOID] ?? itemOID;
    const valueType = cb.readUint8();
    if (valueType === universalTypePrintableString) {
    } else if (valueType === universalTypeUTF8String) {
    } else if (valueType === universalTypeIA5String) {
    } else if (valueType === universalTypeTeletexString) {
    } else {
      throw new Error(`Unexpected item type in certificate ${seqType}: 0x${hexFromU8([valueType])}`);
    }
    const [endItemString, itemStringRemaining] = cb.expectASN1Length(0);
    const itemValue = cb.readUTF8String(itemStringRemaining());
    endItemString();
    endItemSeq();
    endItemSet();
    const existingValue = result[itemName];
    if (existingValue === void 0) result[itemName] = itemValue;
    else if (typeof existingValue === "string") result[itemName] = [existingValue, itemValue];
    else existingValue.push(itemValue);
  }
  endSeq();
  return result;
}
function readNamesSeq(cb, typeUnionBits = 0) {
  const names = [];
  const [endNamesSeq, namesSeqRemaining] = cb.expectASN1Length(0);
  while (namesSeqRemaining() > 0) {
    const type = cb.readUint8(0);
    const [endName, nameRemaining] = cb.expectASN1Length(0);
    let name;
    if (type === (typeUnionBits | 2 /* dNSName */)) {
      name = cb.readUTF8String(nameRemaining());
    } else {
      name = cb.readBytes(nameRemaining());
    }
    names.push({ name, type });
    endName();
  }
  endNamesSeq();
  return names;
}
function algorithmWithOID(oid) {
  const algo = {
    "1.2.840.113549.1.1.1": {
      name: "RSAES-PKCS1-v1_5"
    },
    "1.2.840.113549.1.1.5": {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.113549.1.1.11": {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-256"
      }
    },
    "1.2.840.113549.1.1.12": {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-384"
      }
    },
    "1.2.840.113549.1.1.13": {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-512"
      }
    },
    "1.2.840.113549.1.1.10": {
      name: "RSA-PSS"
    },
    "1.2.840.113549.1.1.7": {
      name: "RSA-OAEP"
    },
    "1.2.840.10045.2.1": {
      // dupes
      name: "ECDSA",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.10045.4.1": {
      // dupes
      name: "ECDSA",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.10045.4.3.2": {
      name: "ECDSA",
      hash: {
        name: "SHA-256"
      }
    },
    "1.2.840.10045.4.3.3": {
      name: "ECDSA",
      hash: {
        name: "SHA-384"
      }
    },
    "1.2.840.10045.4.3.4": {
      name: "ECDSA",
      hash: {
        name: "SHA-512"
      }
    },
    "1.3.133.16.840.63.0.2": {
      name: "ECDH",
      kdf: "SHA-1"
    },
    "1.3.132.1.11.1": {
      name: "ECDH",
      kdf: "SHA-256"
    },
    "1.3.132.1.11.2": {
      name: "ECDH",
      kdf: "SHA-384"
    },
    "1.3.132.1.11.3": {
      name: "ECDH",
      kdf: "SHA-512"
    },
    "2.16.840.1.101.3.4.1.2": {
      name: "AES-CBC",
      length: 128
    },
    "2.16.840.1.101.3.4.1.22": {
      name: "AES-CBC",
      length: 192
    },
    "2.16.840.1.101.3.4.1.42": {
      name: "AES-CBC",
      length: 256
    },
    "2.16.840.1.101.3.4.1.6": {
      name: "AES-GCM",
      length: 128
    },
    "2.16.840.1.101.3.4.1.26": {
      name: "AES-GCM",
      length: 192
    },
    "2.16.840.1.101.3.4.1.46": {
      name: "AES-GCM",
      length: 256
    },
    "2.16.840.1.101.3.4.1.4": {
      name: "AES-CFB",
      length: 128
    },
    "2.16.840.1.101.3.4.1.24": {
      name: "AES-CFB",
      length: 192
    },
    "2.16.840.1.101.3.4.1.44": {
      name: "AES-CFB",
      length: 256
    },
    "2.16.840.1.101.3.4.1.5": {
      name: "AES-KW",
      length: 128
    },
    "2.16.840.1.101.3.4.1.25": {
      name: "AES-KW",
      length: 192
    },
    "2.16.840.1.101.3.4.1.45": {
      name: "AES-KW",
      length: 256
    },
    "1.2.840.113549.2.7": {
      name: "HMAC",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.113549.2.9": {
      name: "HMAC",
      hash: {
        name: "SHA-256"
      }
    },
    "1.2.840.113549.2.10": {
      name: "HMAC",
      hash: {
        name: "SHA-384"
      }
    },
    "1.2.840.113549.2.11": {
      name: "HMAC",
      hash: {
        name: "SHA-512"
      }
    },
    "1.2.840.113549.1.9.16.3.5": {
      name: "DH"
    },
    "1.3.14.3.2.26": {
      name: "SHA-1"
    },
    "2.16.840.1.101.3.4.2.1": {
      name: "SHA-256"
    },
    "2.16.840.1.101.3.4.2.2": {
      name: "SHA-384"
    },
    "2.16.840.1.101.3.4.2.3": {
      name: "SHA-512"
    },
    "1.2.840.113549.1.5.12": {
      name: "PBKDF2"
    },
    // special case: OIDs for ECC curves
    "1.2.840.10045.3.1.7": {
      name: "P-256"
    },
    "1.3.132.0.34": {
      name: "P-384"
    },
    "1.3.132.0.35": {
      name: "P-521"
    }
  }[oid];
  if (algo === void 0) throw new Error(`Unsupported algorithm identifier: ${oid}`);
  return algo;
}
function _descriptionForAlgorithm(algo, desc = []) {
  Object.values(algo).forEach((value) => {
    if (typeof value === "string") desc = [...desc, value];
    else desc = _descriptionForAlgorithm(value, desc);
  });
  return desc;
}
function descriptionForAlgorithm(algo) {
  return _descriptionForAlgorithm(algo).join(" / ");
}

// src/tls/cert.ts
var allKeyUsages = [
  // https://www.rfc-editor.org/rfc/rfc3280#section-4.2.1.3
  "digitalSignature",
  // (0)
  "nonRepudiation",
  // (1)
  "keyEncipherment",
  // (2)
  "dataEncipherment",
  // (3)
  "keyAgreement",
  // (4)
  "keyCertSign",
  // (5)
  "cRLSign",
  // (6)
  "encipherOnly",
  // (7)
  "decipherOnly"
  // (8)
];
var Cert = class _Cert {
  constructor(certData) {
    __publicField(this, "serialNumber");
    __publicField(this, "algorithm");
    __publicField(this, "issuer");
    __publicField(this, "validityPeriod");
    __publicField(this, "subject");
    __publicField(this, "publicKey");
    __publicField(this, "signature");
    __publicField(this, "keyUsage");
    __publicField(this, "subjectAltNames");
    __publicField(this, "extKeyUsage");
    __publicField(this, "authorityKeyIdentifier");
    __publicField(this, "subjectKeyIdentifier");
    __publicField(this, "basicConstraints");
    // nameConstraints?: { critical?: boolean; permitted?: string[]; excluded?: string[] };
    __publicField(this, "signedData");
    if (certData instanceof ASN1Bytes || certData instanceof Uint8Array) {
      const cb = certData instanceof ASN1Bytes ? certData : new ASN1Bytes(certData);
      cb.expectUint8(constructedUniversalTypeSequence, 0);
      const [endCertSeq] = cb.expectASN1Length(0);
      const tbsCertStartOffset = cb.offset;
      cb.expectUint8(constructedUniversalTypeSequence, 0);
      const [endCertInfoSeq] = cb.expectASN1Length(0);
      cb.expectBytes([160, 3, 2, 1, 2], 0);
      cb.expectUint8(universalTypeInteger, 0);
      const [endSerialNumber, serialNumberRemaining] = cb.expectASN1Length(0);
      this.serialNumber = cb.subarray(serialNumberRemaining());
      endSerialNumber();
      cb.expectUint8(constructedUniversalTypeSequence, 0);
      const [endAlgo, algoRemaining] = cb.expectASN1Length(0);
      cb.expectUint8(universalTypeOID, 0);
      this.algorithm = cb.readASN1OID();
      if (algoRemaining() > 0) {
        cb.expectUint8(universalTypeNull, 0);
        cb.expectUint8(0, 0);
      }
      endAlgo();
      this.issuer = readSeqOfSetOfSeq(cb, "issuer");
      let notBefore, notAfter;
      cb.expectUint8(constructedUniversalTypeSequence, 0);
      const [endValiditySeq] = cb.expectASN1Length(0);
      const startTimeType = cb.readUint8();
      if (startTimeType === universalTypeUTCTime) {
        notBefore = cb.readASN1UTCTime();
      } else if (startTimeType === universalTypeGeneralizedTime) {
        notBefore = cb.readASN1GeneralizedTime();
      } else {
        throw new Error(`Unexpected validity start type 0x${hexFromU8([startTimeType])}`);
      }
      const endTimeType = cb.readUint8();
      if (endTimeType === universalTypeUTCTime) {
        notAfter = cb.readASN1UTCTime();
      } else if (endTimeType === universalTypeGeneralizedTime) {
        notAfter = cb.readASN1GeneralizedTime();
      } else {
        throw new Error(`Unexpected validity end type 0x${hexFromU8([endTimeType])}`);
      }
      this.validityPeriod = { notBefore, notAfter };
      endValiditySeq();
      this.subject = readSeqOfSetOfSeq(cb, "subject");
      const publicKeyStartOffset = cb.offset;
      cb.expectUint8(constructedUniversalTypeSequence, 0);
      const [endPublicKeySeq] = cb.expectASN1Length(0);
      cb.expectUint8(constructedUniversalTypeSequence, 0);
      const [endKeyOID, keyOIDRemaining] = cb.expectASN1Length(0);
      const publicKeyOIDs = [];
      while (keyOIDRemaining() > 0) {
        const keyParamRecordType = cb.readUint8();
        if (keyParamRecordType === universalTypeOID) {
          const keyOID = cb.readASN1OID();
          publicKeyOIDs.push(keyOID);
        } else if (keyParamRecordType === universalTypeNull) {
          cb.expectUint8(0, 0);
        }
      }
      endKeyOID();
      cb.expectUint8(universalTypeBitString, 0);
      const publicKeyData = cb.readASN1BitString();
      this.publicKey = { identifiers: publicKeyOIDs, data: publicKeyData, all: cb.data.subarray(publicKeyStartOffset,
      cb.offset) };
      endPublicKeySeq();
      cb.expectUint8(constructedContextSpecificType, 0);
      const [endExtsData] = cb.expectASN1Length();
      cb.expectUint8(constructedUniversalTypeSequence, 0);
      const [endExts, extsRemaining] = cb.expectASN1Length(0);
      while (extsRemaining() > 0) {
        cb.expectUint8(constructedUniversalTypeSequence, 0);
        const [endExt, extRemaining] = cb.expectASN1Length();
        cb.expectUint8(universalTypeOID, 0);
        const extOID = cb.readASN1OID();
        if (extOID === "2.5.29.17") {
          cb.expectUint8(universalTypeOctetString, 0);
          const [endSanDerDoc] = cb.expectASN1Length(0);
          cb.expectUint8(constructedUniversalTypeSequence, 0);
          const allSubjectAltNames = readNamesSeq(cb, contextSpecificType);
          this.subjectAltNames = allSubjectAltNames.filter((san) => san.type === (2 /* dNSName */ | contextSpecificType)).
          map((san) => san.name);
          endSanDerDoc();
        } else if (extOID === "2.5.29.15") {
          let keyUsageCritical;
          let nextType = cb.readUint8();
          if (nextType === universalTypeBoolean) {
            keyUsageCritical = cb.readASN1Boolean(0);
            nextType = cb.readUint8();
          }
          if (nextType !== universalTypeOctetString) throw new Error(`Expected 0x${hexFromU8([universalTypeOctetString])}\
, got 0x${hexFromU8([nextType])}`);
          const [endKeyUsageDer] = cb.expectASN1Length(0);
          cb.expectUint8(universalTypeBitString, 0);
          const keyUsageBitStr = cb.readASN1BitString();
          const keyUsageBitmask = intFromBitString(keyUsageBitStr);
          const keyUsageNames = new Set(allKeyUsages.filter((u, i) => keyUsageBitmask & 1 << i));
          endKeyUsageDer();
          this.keyUsage = {
            critical: keyUsageCritical,
            usages: keyUsageNames
          };
        } else if (extOID === "2.5.29.37") {
          this.extKeyUsage = {};
          cb.expectUint8(universalTypeOctetString, 0);
          const [endExtKeyUsageDer] = cb.expectASN1Length(0);
          cb.expectUint8(constructedUniversalTypeSequence, 0);
          const [endExtKeyUsage, extKeyUsageRemaining] = cb.expectASN1Length(0);
          while (extKeyUsageRemaining() > 0) {
            cb.expectUint8(universalTypeOID, 0);
            const extKeyUsageOID = cb.readASN1OID();
            if (extKeyUsageOID === "1.3.6.1.5.5.7.3.1") this.extKeyUsage.serverTls = true;
            if (extKeyUsageOID === "1.3.6.1.5.5.7.3.2") this.extKeyUsage.clientTls = true;
          }
          endExtKeyUsage();
          endExtKeyUsageDer();
        } else if (extOID === "2.5.29.35") {
          cb.expectUint8(universalTypeOctetString, 0);
          const [endAuthKeyIdDer] = cb.expectASN1Length(0);
          cb.expectUint8(constructedUniversalTypeSequence, 0);
          const [endAuthKeyIdSeq, authKeyIdSeqRemaining] = cb.expectASN1Length(0);
          while (authKeyIdSeqRemaining() > 0) {
            const authKeyIdDatumType = cb.readUint8();
            if (authKeyIdDatumType === (contextSpecificType | 0)) {
              const [endAuthKeyId, authKeyIdRemaining] = cb.expectASN1Length(0);
              this.authorityKeyIdentifier = cb.readBytes(authKeyIdRemaining());
              endAuthKeyId();
            } else if (authKeyIdDatumType === (contextSpecificType | 1)) {
              const [endAuthKeyIdCertIssuer, authKeyIdCertIssuerRemaining] = cb.expectASN1Length(0);
              cb.skip(authKeyIdCertIssuerRemaining(), 0);
              endAuthKeyIdCertIssuer();
            } else if (authKeyIdDatumType === (contextSpecificType | 2)) {
              const [endAuthKeyIdCertSerialNo, authKeyIdCertSerialNoRemaining] = cb.expectASN1Length(0);
              cb.skip(authKeyIdCertSerialNoRemaining(), 0);
              endAuthKeyIdCertSerialNo();
            } else if (authKeyIdDatumType === (contextSpecificType | 33)) {
              const [endDirName, dirNameRemaining] = cb.expectASN1Length(0);
              cb.skip(dirNameRemaining(), 0);
              endDirName();
            } else {
              throw new Error(`Unexpected data type ${authKeyIdDatumType} in authorityKeyIdentifier certificat\
e extension`);
            }
          }
          endAuthKeyIdSeq();
          endAuthKeyIdDer();
        } else if (extOID === "2.5.29.14") {
          cb.expectUint8(universalTypeOctetString, 0);
          const [endSubjectKeyIdDer] = cb.expectASN1Length(0);
          cb.expectUint8(universalTypeOctetString, 0);
          const [endSubjectKeyId, subjectKeyIdRemaining] = cb.expectASN1Length(0);
          this.subjectKeyIdentifier = cb.readBytes(subjectKeyIdRemaining());
          endSubjectKeyId();
          endSubjectKeyIdDer();
        } else if (extOID === "2.5.29.19") {
          let basicConstraintsCritical;
          let bcNextType = cb.readUint8();
          if (bcNextType === universalTypeBoolean) {
            basicConstraintsCritical = cb.readASN1Boolean(0);
            bcNextType = cb.readUint8();
          }
          if (bcNextType !== universalTypeOctetString) throw new Error("Unexpected type in certificate basic c\
onstraints");
          const [endBasicConstraintsDer] = cb.expectASN1Length(0);
          cb.expectUint8(constructedUniversalTypeSequence, 0);
          const [endConstraintsSeq, constraintsSeqRemaining] = cb.expectASN1Length();
          let basicConstraintsCa = void 0;
          if (constraintsSeqRemaining() > 0) {
            cb.expectUint8(universalTypeBoolean, 0);
            basicConstraintsCa = cb.readASN1Boolean(0);
          }
          let basicConstraintsPathLength;
          if (constraintsSeqRemaining() > 0) {
            cb.expectUint8(universalTypeInteger, 0);
            const maxPathLengthLength = cb.readASN1Length(0);
            basicConstraintsPathLength = maxPathLengthLength === 1 ? cb.readUint8() : maxPathLengthLength === 2 ?
            cb.readUint16() : maxPathLengthLength === 3 ? cb.readUint24() : void 0;
            if (basicConstraintsPathLength === void 0) throw new Error("Too many bytes in max path length in c\
ertificate basicConstraints");
          }
          endConstraintsSeq();
          endBasicConstraintsDer();
          this.basicConstraints = {
            critical: basicConstraintsCritical,
            ca: basicConstraintsCa,
            pathLength: basicConstraintsPathLength
          };
        } else if (0) {
          cb.expectUint8(universalTypeOctetString, 0);
          const [endAuthInfoAccessDER] = cb.expectASN1Length(0);
          cb.expectUint8(constructedUniversalTypeSequence, 0);
          const [endAuthInfoAccessSeq, authInfoAccessSeqRemaining] = cb.expectASN1Length(0);
          while (authInfoAccessSeqRemaining() > 0) {
            cb.expectUint8(constructedUniversalTypeSequence, 0);
            const [endAuthInfoAccessInnerSeq] = cb.expectASN1Length(0);
            cb.expectUint8(universalTypeOID, 0);
            const accessMethodOID = cb.readASN1OID();
            cb.expectUint8(contextSpecificType | 6 /* uniformResourceIdentifier */, 0);
            const [endMethodURI, methodURIRemaining] = cb.expectASN1Length(0);
            cb.readUTF8String(methodURIRemaining());
            endMethodURI();
            endAuthInfoAccessInnerSeq();
          }
          endAuthInfoAccessSeq();
          endAuthInfoAccessDER();
        } else if (0) {
          cb.expectUint8(universalTypeOctetString, 0);
          const [endCertPolDER] = cb.expectASN1Length(0);
          cb.expectUint8(constructedUniversalTypeSequence, 0);
          const [endCertPolSeq, certPolSeqRemaining] = cb.expectASN1Length(0);
          while (certPolSeqRemaining() > 0) {
            cb.expectUint8(constructedUniversalTypeSequence, 0);
            const [endCertPolInnerSeq, certPolInnerSeqRemaining] = cb.expectASN1Length(0);
            cb.expectUint8(universalTypeOID, 0);
            const certPolOID = cb.readASN1OID();
            while (certPolInnerSeqRemaining() > 0) {
              cb.expectUint8(constructedUniversalTypeSequence, 0);
              const [endCertPolInner2Seq, certPolInner2SeqRemaining] = cb.expectASN1Length(0);
              while (certPolInner2SeqRemaining() > 0) {
                cb.expectUint8(constructedUniversalTypeSequence, 0);
                const [endCertPolInner3Seq, certPolInner3SeqRemaining] = cb.expectASN1Length(0);
                cb.expectUint8(universalTypeOID, 0);
                const certPolQualOID = cb.readASN1OID();
                const qualType = cb.readUint8();
                if (0) {
                  cb.comment("IA5String");
                  const [endQualStr, qualStrRemaining] = cb.expectASN1Length("string");
                  cb.readUTF8String(qualStrRemaining());
                  endQualStr();
                } else {
                  if (certPolInner3SeqRemaining()) cb.skip(certPolInner3SeqRemaining(), "skipped policy qualif\
ier data");
                }
                endCertPolInner3Seq();
              }
              endCertPolInner2Seq();
            }
            endCertPolInnerSeq();
          }
          endCertPolSeq();
          endCertPolDER();
        } else {
          cb.skip(extRemaining(), 0);
        }
        endExt();
      }
      endExts();
      endExtsData();
      endCertInfoSeq();
      this.signedData = cb.data.subarray(tbsCertStartOffset, cb.offset);
      cb.expectUint8(constructedUniversalTypeSequence, 0);
      const [endSigAlgo, sigAlgoRemaining] = cb.expectASN1Length(0);
      cb.expectUint8(universalTypeOID, 0);
      const sigAlgoOID = cb.readASN1OID(0);
      if (sigAlgoRemaining() > 0) {
        cb.expectUint8(universalTypeNull, 0);
        cb.expectUint8(0, 0);
      }
      endSigAlgo();
      if (sigAlgoOID !== this.algorithm) throw new Error(`Certificate specifies different signature algorithms\
 inside(${this.algorithm}) and out(${sigAlgoOID})`);
      cb.expectUint8(universalTypeBitString, 0);
      this.signature = cb.readASN1BitString();
      endCertSeq();
    } else {
      this.serialNumber = u8FromHex(certData.serialNumber);
      this.algorithm = certData.algorithm;
      this.issuer = certData.issuer;
      this.validityPeriod = {
        notBefore: new Date(certData.validityPeriod.notBefore),
        notAfter: new Date(certData.validityPeriod.notAfter)
      };
      this.subject = certData.subject;
      this.publicKey = {
        identifiers: certData.publicKey.identifiers,
        data: u8FromHex(certData.publicKey.data),
        all: u8FromHex(certData.publicKey.all)
      };
      this.signature = u8FromHex(certData.signature);
      this.keyUsage = {
        critical: certData.keyUsage.critical,
        usages: new Set(certData.keyUsage.usages)
      };
      this.subjectAltNames = certData.subjectAltNames;
      this.extKeyUsage = certData.extKeyUsage;
      if (certData.authorityKeyIdentifier) this.authorityKeyIdentifier = u8FromHex(certData.authorityKeyIdentifier);
      if (certData.subjectKeyIdentifier) this.subjectKeyIdentifier = u8FromHex(certData.subjectKeyIdentifier);
      this.basicConstraints = certData.basicConstraints;
      this.signedData = u8FromHex(certData.signedData);
    }
  }
  static distinguishedNamesAreEqual(dn1, dn2) {
    return this.stringFromDistinguishedName(dn1) === this.stringFromDistinguishedName(dn2);
  }
  static stringFromDistinguishedName(dn) {
    return Object.entries(dn).map(
      ([k, vs]) => typeof vs === "string" ? `${k}=${vs.trim().replace(/[\\,]/g, "\\$&")}` : vs.map((v) => `${k}\
=${v.trim().replace(/[\\,]/g, "\\$&")}`).join(", ")
    ).join(", ");
  }
  subjectAltNameMatchingHost(host) {
    const twoDotRegex = /[.][^.]+[.][^.]+$/;
    return (this.subjectAltNames ?? []).find((cert) => {
      let certName = cert;
      let hostName = host;
      if (twoDotRegex.test(host) && twoDotRegex.test(certName) && certName.startsWith("*.")) {
        certName = certName.slice(1);
        hostName = hostName.slice(hostName.indexOf("."));
      }
      if (certName === hostName) return true;
    });
  }
  isValidAtMoment(moment = /* @__PURE__ */ new Date()) {
    return moment >= this.validityPeriod.notBefore && moment <= this.validityPeriod.notAfter;
  }
  description() {
    return "subject: " + _Cert.stringFromDistinguishedName(this.subject) + (this.subjectAltNames ? "\nsubject a\
lt names: " + this.subjectAltNames.join(", ") : "") + (this.subjectKeyIdentifier ? `
subject key id: ${hexFromU8(this.subjectKeyIdentifier, " ")}` : "") + "\nissuer: " + _Cert.stringFromDistinguishedName(
    this.issuer) + (this.authorityKeyIdentifier ? `
authority key id: ${hexFromU8(this.authorityKeyIdentifier, " ")}` : "") + "\nvalidity: " + this.validityPeriod.
    notBefore.toISOString() + " \u2013 " + this.validityPeriod.notAfter.toISOString() + ` (${this.isValidAtMoment() ?
    "currently valid" : "not valid"})` + (this.keyUsage ? `
key usage (${this.keyUsage.critical ? "critical" : "non-critical"}): ` + [...this.keyUsage.usages].join(", ") :
    "") + (this.extKeyUsage ? `
extended key usage: TLS server \u2014\xA0${this.extKeyUsage.serverTls}, TLS client \u2014\xA0${this.extKeyUsage.
    clientTls}` : "") + (this.basicConstraints ? `
basic constraints (${this.basicConstraints.critical ? "critical" : "non-critical"}): CA \u2014\xA0${this.basicConstraints.
    ca}, path length \u2014 ${this.basicConstraints.pathLength}` : "") + "\nsignature algorithm: " + descriptionForAlgorithm(
    algorithmWithOID(this.algorithm));
  }
  toJSON() {
    return {
      serialNumber: hexFromU8(this.serialNumber),
      algorithm: this.algorithm,
      issuer: this.issuer,
      validityPeriod: {
        notBefore: this.validityPeriod.notBefore.toISOString(),
        notAfter: this.validityPeriod.notAfter.toISOString()
      },
      subject: this.subject,
      publicKey: {
        identifiers: this.publicKey.identifiers,
        data: hexFromU8(this.publicKey.data),
        all: hexFromU8(this.publicKey.all)
      },
      signature: hexFromU8(this.signature),
      keyUsage: {
        critical: this.keyUsage?.critical,
        usages: [...this.keyUsage?.usages ?? []]
      },
      subjectAltNames: this.subjectAltNames,
      extKeyUsage: this.extKeyUsage,
      authorityKeyIdentifier: this.authorityKeyIdentifier && hexFromU8(this.authorityKeyIdentifier),
      subjectKeyIdentifier: this.subjectKeyIdentifier && hexFromU8(this.subjectKeyIdentifier),
      basicConstraints: this.basicConstraints,
      signedData: hexFromU8(this.signedData)
    };
  }
  static uint8ArraysFromPEM(pem) {
    const tag = "[A-Z0-9 ]+";
    const pattern = new RegExp(`-----BEGIN ${tag}-----([a-zA-Z0-9=+\\/\\n\\r]+)-----END ${tag}-----`, "g");
    const res = [];
    let matches = null;
    while (matches = pattern.exec(pem)) {
      const base64 = matches[1].replace(/[\r\n]/g, "");
      const binary = base64Decode(base64);
      res.push(binary);
    }
    return res;
  }
  static fromPEM(pem) {
    return this.uint8ArraysFromPEM(pem).map((arr) => new this(arr));
  }
};
var TrustedCert = class extends Cert {
  static databaseFromPEM(pem) {
    const certsData = this.uint8ArraysFromPEM(pem);
    const offsets = [0];
    const subjects = {};
    const growable = new GrowableData();
    for (const certData of certsData) {
      const cert = new this(certData);
      const offsetIndex = offsets.length - 1;
      if (cert.subjectKeyIdentifier) subjects[hexFromU8(cert.subjectKeyIdentifier)] = offsetIndex;
      subjects[this.stringFromDistinguishedName(cert.subject)] = offsetIndex;
      growable.append(certData);
      offsets[offsets.length] = offsets[offsetIndex] + certData.length;
    }
    const data = growable.getData();
    return { index: { offsets, subjects }, data };
  }
  static findInDatabase(subjectOrSubjectKeyId, db) {
    const { index: { subjects, offsets }, data } = db;
    const key = typeof subjectOrSubjectKeyId === "string" ? subjectOrSubjectKeyId : Cert.stringFromDistinguishedName(
    subjectOrSubjectKeyId);
    const offsetIndex = subjects[key];
    if (offsetIndex === void 0) return;
    const start = offsets[offsetIndex];
    const end = offsets[offsetIndex + 1];
    const certData = data.subarray(start, end);
    const cert = new this(certData);
    return cert;
  }
};

// src/tls/ecdsa.ts
async function ecdsaVerify(sb, publicKey, signedData, namedCurve, hash) {
  sb.expectUint8(constructedUniversalTypeSequence, 0);
  const [endSigDer] = sb.expectASN1Length(0);
  sb.expectUint8(universalTypeInteger, 0);
  const [endSigRBytes, sigRBytesRemaining] = sb.expectASN1Length(0);
  let sigR = sb.readBytes(sigRBytesRemaining());
  endSigRBytes();
  sb.expectUint8(universalTypeInteger, 0);
  const [endSigSBytes, sigSBytesRemaining] = sb.expectASN1Length(0);
  let sigS = sb.readBytes(sigSBytesRemaining());
  endSigSBytes();
  endSigDer();
  const clampToLength = (x, clampLength) => x.length > clampLength ? x.subarray(x.length - clampLength) : (
    // too long? cut off leftmost bytes (msb)
    x.length < clampLength ? concat(new Uint8Array(clampLength - x.length), x) : (
      // too short? left pad with zeroes
      x
    )
  );
  const intLength = namedCurve === "P-256" ? 32 : 48;
  const signature = concat(clampToLength(sigR, intLength), clampToLength(sigS, intLength));
  const signatureKey = await cryptoProxy_default.importKey("spki", publicKey, { name: "ECDSA", namedCurve }, false,
  ["verify"]);
  const certVerifyResult = await cryptoProxy_default.verify({ name: "ECDSA", hash }, signatureKey, signature, signedData);
  if (certVerifyResult !== true) throw new Error("ECDSA-SECP256R1-SHA256 certificate verify failed");
}

// src/tls/verifyCerts.ts
async function verifyCerts(host, certs, rootCertsDatabase, requireServerTlsExtKeyUsage = true, requireDigitalSigKeyUsage = true) {
  for (const cert of certs) ;
  const userCert = certs[0];
  const matchingSubjectAltName = userCert.subjectAltNameMatchingHost(host);
  if (matchingSubjectAltName === void 0) throw new Error(`No matching subjectAltName for ${host}`);
  const validNow = userCert.isValidAtMoment();
  if (!validNow) throw new Error("End-user certificate is not valid now");
  if (requireServerTlsExtKeyUsage) {
    if (!userCert.extKeyUsage?.serverTls) throw new Error("End-user certificate has no TLS server extKeyUsage");
  }
  let verifiedToTrustedRoot = false;
  for (let i = 0, len = certs.length; i < len; i++) {
    const subjectCert = certs[i];
    const subjectAuthKeyId = subjectCert.authorityKeyIdentifier;
    let signingCert;
    if (subjectAuthKeyId === void 0) {
      signingCert = TrustedCert.findInDatabase(subjectCert.issuer, rootCertsDatabase);
    } else {
      signingCert = TrustedCert.findInDatabase(hexFromU8(subjectAuthKeyId), rootCertsDatabase);
    }
    if (signingCert !== void 0) {
    }
    if (signingCert === void 0) signingCert = certs[i + 1];
    if (signingCert === void 0) throw new Error("Ran out of certificates before reaching trusted root");
    const signingCertIsTrustedRoot = signingCert instanceof TrustedCert;
    if (signingCert.isValidAtMoment() !== true) throw new Error("Signing certificate is not valid now");
    if (requireDigitalSigKeyUsage) {
      if (signingCert.keyUsage?.usages.has("digitalSignature") !== true) throw new Error("Signing certificate \
keyUsage does not include digital signatures");
    }
    if (signingCert.basicConstraints?.ca !== true) throw new Error("Signing certificate basicConstraints do no\
t indicate a CA certificate");
    const { pathLength } = signingCert.basicConstraints;
    if (pathLength === void 0) {
    } else {
      if (pathLength < i) throw new Error("Exceeded certificate pathLength");
    }
    if (subjectCert.algorithm === "1.2.840.10045.4.3.2" || subjectCert.algorithm === "1.2.840.10045.4.3.3") {
      const hash = subjectCert.algorithm === "1.2.840.10045.4.3.2" ? "SHA-256" : "SHA-384";
      const signingKeyOIDs = signingCert.publicKey.identifiers;
      const namedCurve = signingKeyOIDs.includes("1.2.840.10045.3.1.7") ? "P-256" : signingKeyOIDs.includes("1\
.3.132.0.34") ? "P-384" : void 0;
      if (namedCurve === void 0) throw new Error("Unsupported signing key curve");
      const sb = new ASN1Bytes(subjectCert.signature);
      await ecdsaVerify(sb, signingCert.publicKey.all, subjectCert.signedData, namedCurve, hash);
    } else if (subjectCert.algorithm === "1.2.840.113549.1.1.11" || subjectCert.algorithm === "1.2.840.113549.\
1.1.12") {
      const hash = subjectCert.algorithm === "1.2.840.113549.1.1.11" ? "SHA-256" : "SHA-384";
      const signatureKey = await cryptoProxy_default.importKey("spki", signingCert.publicKey.all, { name: "RSA\
SSA-PKCS1-v1_5", hash }, false, ["verify"]);
      const certVerifyResult = await cryptoProxy_default.verify({ name: "RSASSA-PKCS1-v1_5" }, signatureKey, subjectCert.
      signature, subjectCert.signedData);
      if (certVerifyResult !== true) throw new Error("RSASSA_PKCS1-v1_5-SHA256 certificate verify failed");
    } else {
      throw new Error("Unsupported signing algorithm");
    }
    if (signingCertIsTrustedRoot) {
      verifiedToTrustedRoot = true;
      break;
    }
  }
  return verifiedToTrustedRoot;
}

// src/tls/readEncryptedHandshake.ts
var txtEnc3 = new TextEncoder();
async function readEncryptedHandshake(host, readHandshakeRecord, serverSecret, hellos, rootCertsDatabase, requireServerTlsExtKeyUsage = true, requireDigitalSigKeyUsage = true) {
  const hs = new ASN1Bytes(await readHandshakeRecord());
  hs.expectUint8(8, 0);
  const [eeMessageEnd] = hs.expectLengthUint24();
  const [extEnd, extRemaining] = hs.expectLengthUint16(0);
  while (extRemaining() > 0) {
    const extType = hs.readUint16(0);
    if (extType === 0) {
      hs.expectUint16(0, 0);
    } else if (extType === 10) {
      const [endGroupsData] = hs.expectLengthUint16(0);
      const [endGroups, groupsRemaining] = hs.expectLengthUint16(0);
      while (groupsRemaining() > 0) {
        const group = hs.readUint16();
        if (0) {
          const groupName = {
            23: "secp256r1",
            24: "secp384r1",
            25: "secp521r1",
            29: "x25519",
            30: "x448",
            256: "ffdhe2048",
            257: "ffdhe3072",
            258: "ffdhe4096",
            259: "ffdhe6144",
            260: "ffdhe8192"
          }[group] ?? "unrecognised group";
          hs.comment(`group: ${groupName}`);
        }
      }
      endGroups();
      endGroupsData();
    } else {
      throw new Error(`Unsupported server encrypted extension type 0x${hexFromU8([extType]).padStart(4, "0")}`);
    }
  }
  extEnd();
  eeMessageEnd();
  if (hs.remaining() === 0) hs.extend(await readHandshakeRecord());
  let clientCertRequested = false;
  let certMsgType = hs.readUint8();
  if (certMsgType === 13) {
    clientCertRequested = true;
    const [endCertReq] = hs.expectLengthUint24("certificate request data");
    hs.expectUint8(0, 0);
    const [endCertReqExts, certReqExtsRemaining] = hs.expectLengthUint16("certificate request extensions");
    hs.skip(certReqExtsRemaining(), 0);
    endCertReqExts();
    endCertReq();
    if (hs.remaining() === 0) hs.extend(await readHandshakeRecord());
    certMsgType = hs.readUint8();
  }
  if (certMsgType !== 11) throw new Error(`Unexpected handshake message type 0x${hexFromU8([certMsgType])}`);
  const [endCertPayload] = hs.expectLengthUint24(0);
  hs.expectUint8(0, 0);
  const [endCerts, certsRemaining] = hs.expectLengthUint24(0);
  const certs = [];
  while (certsRemaining() > 0) {
    const [endCert] = hs.expectLengthUint24(0);
    const cert = new Cert(hs);
    certs.push(cert);
    endCert();
    const [endCertExt, certExtRemaining] = hs.expectLengthUint16("certificate extensions");
    hs.skip(certExtRemaining());
    endCertExt();
  }
  endCerts();
  endCertPayload();
  if (certs.length === 0) throw new Error("No certificates supplied");
  const userCert = certs[0];
  const certVerifyHandshakeData = hs.data.subarray(0, hs.offset);
  const certVerifyData = concat(hellos, certVerifyHandshakeData);
  const certVerifyHashBuffer = await cryptoProxy_default.digest("SHA-256", certVerifyData);
  const certVerifyHash = new Uint8Array(certVerifyHashBuffer);
  const certVerifySignedData = concat(txtEnc3.encode(" ".repeat(64) + "TLS 1.3, server CertificateVerify"), [0],
  certVerifyHash);
  if (hs.remaining() === 0) hs.extend(await readHandshakeRecord());
  hs.expectUint8(15, 0);
  const [endCertVerifyPayload] = hs.expectLengthUint24(0);
  const sigType = hs.readUint16();
  if (sigType === 1027) {
    const [endSignature] = hs.expectLengthUint16();
    await ecdsaVerify(hs, userCert.publicKey.all, certVerifySignedData, "P-256", "SHA-256");
    endSignature();
  } else if (sigType === 2052) {
    const [endSignature, signatureRemaining] = hs.expectLengthUint16();
    const signature = hs.subarray(signatureRemaining());
    endSignature();
    const signatureKey = await cryptoProxy_default.importKey("spki", userCert.publicKey.all, { name: "RSA-PSS",
    hash: "SHA-256" }, false, ["verify"]);
    const certVerifyResult = await cryptoProxy_default.verify({
      name: "RSA-PSS",
      saltLength: 32
      /* SHA-256 length in bytes */
    }, signatureKey, signature, certVerifySignedData);
    if (certVerifyResult !== true) throw new Error("RSA-PSS-RSAE-SHA256 certificate verify failed");
  } else {
    throw new Error(`Unsupported certificate verify signature type 0x${hexFromU8([sigType]).padStart(4, "0")}`);
  }
  endCertVerifyPayload();
  const verifyHandshakeData = hs.data.subarray(0, hs.offset);
  const verifyData = concat(hellos, verifyHandshakeData);
  const finishedKey = await hkdfExpandLabel(serverSecret, "finished", new Uint8Array(0), 32, 256);
  const finishedHash = await cryptoProxy_default.digest("SHA-256", verifyData);
  const hmacKey = await cryptoProxy_default.importKey("raw", finishedKey, { name: "HMAC", hash: { name: `SHA-2\
56` } }, false, ["sign"]);
  const correctVerifyHashBuffer = await cryptoProxy_default.sign("HMAC", hmacKey, finishedHash);
  const correctVerifyHash = new Uint8Array(correctVerifyHashBuffer);
  if (hs.remaining() === 0) hs.extend(await readHandshakeRecord());
  hs.expectUint8(20, 0);
  const [endHsFinishedPayload, hsFinishedPayloadRemaining] = hs.expectLengthUint24(0);
  const verifyHash = hs.readBytes(hsFinishedPayloadRemaining());
  endHsFinishedPayload();
  if (hs.remaining() !== 0) throw new Error("Unexpected extra bytes in server handshake");
  const verifyHashVerified = equal(verifyHash, correctVerifyHash);
  if (verifyHashVerified !== true) throw new Error("Invalid server verify hash");
  const verifiedToTrustedRoot = await verifyCerts(host, certs, rootCertsDatabase, requireServerTlsExtKeyUsage,
  requireDigitalSigKeyUsage);
  if (!verifiedToTrustedRoot) throw new Error("Validated certificate chain did not end in a trusted root");
  return [hs.data, clientCertRequested];
}

// src/tls/startTls.ts
async function startTls(host, rootCertsDatabase, networkRead, networkWrite, { useSNI, requireServerTlsExtKeyUsage,
requireDigitalSigKeyUsage, writePreData, expectPreData, commentPreData } = {}) {
  useSNI ?? (useSNI = true);
  requireServerTlsExtKeyUsage ?? (requireServerTlsExtKeyUsage = true);
  requireDigitalSigKeyUsage ?? (requireDigitalSigKeyUsage = true);
  if (typeof rootCertsDatabase === "string") rootCertsDatabase = TrustedCert.databaseFromPEM(rootCertsDatabase);
  const ecdhKeys = await cryptoProxy_default.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["derive\
Key", "deriveBits"]);
  const rawPublicKeyBuffer = await cryptoProxy_default.exportKey("raw", ecdhKeys.publicKey);
  const rawPublicKey = new Uint8Array(rawPublicKeyBuffer);
  if (0) {
    const privateKeyJWK = await cryptoProxy_default.exportKey("jwk", ecdhKeys.privateKey);
    log7("We begin the TLS connection by generating an [ECDH](https://en.wikipedia.org/wiki/Elliptic-curve_Dif\
fie%E2%80%93Hellman) key pair using curve [P-256](https://neuromancer.sk/std/nist/P-256). The private key, d, \
is simply a 256-bit integer picked at random:");
    log7(...highlightColonList3("d: " + hexFromU84(base64Decode2(privateKeyJWK.d, urlCharCodes))));
    log7("The public key is a point on the curve. The point is [derived from d and a base point](https://curve\
s.xargs.org). It\u2019s identified by coordinates x and y.");
    log7(...highlightColonList3("x: " + hexFromU84(base64Decode2(privateKeyJWK.x, urlCharCodes))));
    log7(...highlightColonList3("y: " + hexFromU84(base64Decode2(privateKeyJWK.y, urlCharCodes))));
  }
  const sessionId = new Uint8Array(32);
  crypto.getRandomValues(sessionId);
  const clientHello = makeClientHello(host, rawPublicKey, sessionId, useSNI);
  const clientHelloData = clientHello.array();
  const initialData = writePreData ? concat(writePreData, clientHelloData) : clientHelloData;
  networkWrite(initialData);
  if (expectPreData) {
    const receivedPreData = await networkRead(expectPreData.length);
    if (!receivedPreData || !equal(receivedPreData, expectPreData)) throw new Error("Pre data did not match ex\
pectation");
  }
  const serverHelloRecord = await readTlsRecord(networkRead, 22 /* Handshake */);
  if (serverHelloRecord === void 0) throw new Error("Connection closed while awaiting server hello");
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverPublicKey = parseServerHello(serverHello, sessionId);
  const changeCipherRecord = await readTlsRecord(networkRead, 20 /* ChangeCipherSpec */);
  if (changeCipherRecord === void 0) throw new Error("Connection closed awaiting server cipher change");
  const ccipher = new Bytes(changeCipherRecord.content);
  const [endCipherPayload] = ccipher.expectLength(1);
  ccipher.expectUint8(1, 0);
  endCipherPayload();
  const clientHelloContent = clientHelloData.subarray(5);
  const serverHelloContent = serverHelloRecord.content;
  const hellos = concat(clientHelloContent, serverHelloContent);
  const handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16);
  const serverHandshakeKey = await cryptoProxy_default.importKey("raw", handshakeKeys.serverHandshakeKey, { name: "\
AES-GCM" }, false, ["decrypt"]);
  const handshakeDecrypter = new Crypter("decrypt", serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await cryptoProxy_default.importKey("raw", handshakeKeys.clientHandshakeKey, { name: "\
AES-GCM" }, false, ["encrypt"]);
  const handshakeEncrypter = new Crypter("encrypt", clientHandshakeKey, handshakeKeys.clientHandshakeIV);
  const readHandshakeRecord = async () => {
    const tlsRecord = await readEncryptedTlsRecord(networkRead, handshakeDecrypter, 22 /* Handshake */);
    if (tlsRecord === void 0) throw new Error("Premature end of encrypted server handshake");
    return tlsRecord;
  };
  const [serverHandshake, clientCertRequested] = await readEncryptedHandshake(
    host,
    readHandshakeRecord,
    handshakeKeys.serverSecret,
    hellos,
    rootCertsDatabase,
    requireServerTlsExtKeyUsage,
    requireDigitalSigKeyUsage
  );
  const clientCipherChange = new Bytes(6);
  clientCipherChange.writeUint8(20, 0);
  clientCipherChange.writeUint16(771, 0);
  const endClientCipherChangePayload = clientCipherChange.writeLengthUint16();
  clientCipherChange.writeUint8(1, 0);
  endClientCipherChangePayload();
  const clientCipherChangeData = clientCipherChange.array();
  let clientCertRecordData = new Uint8Array(0);
  if (clientCertRequested) {
    const clientCertRecord = new Bytes(8);
    clientCertRecord.writeUint8(11, 0);
    const endClientCerts = clientCertRecord.writeLengthUint24("client certificate data");
    clientCertRecord.writeUint8(0, 0);
    clientCertRecord.writeUint24(0, 0);
    endClientCerts();
    clientCertRecordData = clientCertRecord.array();
  }
  const wholeHandshake = concat(hellos, serverHandshake, clientCertRecordData);
  const wholeHandshakeHashBuffer = await cryptoProxy_default.digest("SHA-256", wholeHandshake);
  const wholeHandshakeHash = new Uint8Array(wholeHandshakeHashBuffer);
  const finishedKey = await hkdfExpandLabel(handshakeKeys.clientSecret, "finished", new Uint8Array(0), 32, 256);
  const verifyHmacKey = await cryptoProxy_default.importKey("raw", finishedKey, { name: "HMAC", hash: { name: "\
SHA-256" } }, false, ["sign"]);
  const verifyDataBuffer = await cryptoProxy_default.sign("HMAC", verifyHmacKey, wholeHandshakeHash);
  const verifyData = new Uint8Array(verifyDataBuffer);
  const clientFinishedRecord = new Bytes(36);
  clientFinishedRecord.writeUint8(20, 0);
  const clientFinishedRecordEnd = clientFinishedRecord.writeLengthUint24(0);
  clientFinishedRecord.writeBytes(verifyData);
  clientFinishedRecordEnd();
  const clientFinishedRecordData = clientFinishedRecord.array();
  const encryptedClientFinished = await makeEncryptedTlsRecords(concat(clientCertRecordData, clientFinishedRecordData),
  handshakeEncrypter, 22 /* Handshake */);
  let partialHandshakeHash = wholeHandshakeHash;
  if (clientCertRecordData.length > 0) {
    const partialHandshake = wholeHandshake.subarray(0, wholeHandshake.length - clientCertRecordData.length);
    const partialHandshakeHashBuffer = await cryptoProxy_default.digest("SHA-256", partialHandshake);
    partialHandshakeHash = new Uint8Array(partialHandshakeHashBuffer);
  }
  const applicationKeys = await getApplicationKeys(handshakeKeys.handshakeSecret, partialHandshakeHash, 256, 16);
  const clientApplicationKey = await cryptoProxy_default.importKey("raw", applicationKeys.clientApplicationKey,
  { name: "AES-GCM" }, true, ["encrypt"]);
  const applicationEncrypter = new Crypter("encrypt", clientApplicationKey, applicationKeys.clientApplicationIV);
  const serverApplicationKey = await cryptoProxy_default.importKey("raw", applicationKeys.serverApplicationKey,
  { name: "AES-GCM" }, true, ["decrypt"]);
  const applicationDecrypter = new Crypter("decrypt", serverApplicationKey, applicationKeys.serverApplicationIV);
  let wroteFinishedRecords = false;
  const read = () => {
    if (!wroteFinishedRecords) {
      const finishedRecords = concat(clientCipherChangeData, ...encryptedClientFinished);
      networkWrite(finishedRecords);
      wroteFinishedRecords = true;
    }
    return readEncryptedTlsRecord(networkRead, applicationDecrypter);
  };
  const write = async (data) => {
    const localWroteFinishedRecords = wroteFinishedRecords;
    wroteFinishedRecords = true;
    const encryptedRecords = await makeEncryptedTlsRecords(data, applicationEncrypter, 23 /* Application */);
    const allRecords = localWroteFinishedRecords ? concat(...encryptedRecords) : concat(clientCipherChangeData,
    ...encryptedClientFinished, ...encryptedRecords);
    networkWrite(allRecords);
  };
  return [read, write];
}

// src/util/readqueue.ts
var ReadQueue = class {
  constructor() {
    __publicField(this, "queue");
    __publicField(this, "outstandingRequest");
    this.queue = [];
  }
  enqueue(data) {
    this.queue.push(data);
    this.dequeue();
  }
  dequeue() {
    if (this.outstandingRequest === void 0) return;
    let { resolve, bytes } = this.outstandingRequest;
    const bytesInQueue = this.bytesInQueue();
    if (bytesInQueue < bytes && this.socketIsNotClosed()) return;
    bytes = Math.min(bytes, bytesInQueue);
    if (bytes === 0) return resolve(void 0);
    this.outstandingRequest = void 0;
    const firstItem = this.queue[0];
    const firstItemLength = firstItem.length;
    if (firstItemLength === bytes) {
      this.queue.shift();
      return resolve(firstItem);
    } else if (firstItemLength > bytes) {
      this.queue[0] = firstItem.subarray(bytes);
      return resolve(firstItem.subarray(0, bytes));
    } else {
      const result = new Uint8Array(bytes);
      let outstandingBytes = bytes;
      let offset = 0;
      while (outstandingBytes > 0) {
        const nextItem = this.queue[0];
        const nextItemLength = nextItem.length;
        if (nextItemLength <= outstandingBytes) {
          this.queue.shift();
          result.set(nextItem, offset);
          offset += nextItemLength;
          outstandingBytes -= nextItemLength;
        } else {
          this.queue[0] = nextItem.subarray(outstandingBytes);
          result.set(nextItem.subarray(0, outstandingBytes), offset);
          outstandingBytes -= outstandingBytes;
          offset += outstandingBytes;
        }
      }
      return resolve(result);
    }
  }
  bytesInQueue() {
    return this.queue.reduce((memo, arr) => memo + arr.length, 0);
  }
  async read(bytes) {
    if (this.outstandingRequest !== void 0) throw new Error("Can\u2019t read while already awaiting read");
    return new Promise((resolve) => {
      this.outstandingRequest = { resolve, bytes };
      this.dequeue();
    });
  }
};
var WebSocketReadQueue = class extends ReadQueue {
  constructor(socket) {
    super();
    this.socket = socket;
    socket.addEventListener("message", (msg) => this.enqueue(new Uint8Array(msg.data)));
    socket.addEventListener("close", () => this.dequeue());
  }
  socketIsNotClosed() {
    const { socket } = this;
    const { readyState } = socket;
    return readyState <= 1 /* OPEN */;
  }
};
var SocketReadQueue = class extends ReadQueue {
  constructor(socket) {
    super();
    this.socket = socket;
    socket.on("data", (data) => this.enqueue(new Uint8Array(data)));
    socket.on("close", () => this.dequeue());
  }
  socketIsNotClosed() {
    const { socket } = this;
    const { readyState } = socket;
    return readyState === "opening" || readyState === "open";
  }
};

// src/util/stableStringify.ts
function stableStringify(x, replacer = (_, v) => v, indent) {
  const deterministicReplacer = (k, v) => replacer(
    k,
    typeof v !== "object" || v === null || Array.isArray(v) ? v : Object.fromEntries(Object.entries(v).sort(([
    ka], [kb]) => ka < kb ? -1 : ka > kb ? 1 : 0))
  );
  return JSON.stringify(x, deterministicReplacer, indent);
}
export {
  SocketReadQueue,
  TrustedCert,
  WebSocketReadQueue,
  base64Decode,
  hexFromU8,
  stableStringify,
  startTls,
  u8FromHex
};
