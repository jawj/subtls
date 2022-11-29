// src/util/readqueue.ts
var ReadQueue = class {
  constructor(ws) {
    this.ws = ws;
    this.queue = [];
    ws.addEventListener("message", (msg) => this.enqueue(new Uint8Array(msg.data)));
    ws.addEventListener("close", () => this.dequeue());
  }
  queue;
  outstandingRequest;
  enqueue(data) {
    this.queue.push(data);
    this.dequeue();
  }
  dequeue() {
    if (this.outstandingRequest === void 0)
      return;
    let { resolve, bytes } = this.outstandingRequest;
    const bytesInQueue = this.bytesInQueue();
    if (bytesInQueue < bytes && this.ws.readyState <= 1 /* OPEN */)
      return;
    bytes = Math.min(bytes, bytesInQueue);
    if (bytes === 0)
      return resolve(void 0);
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
    if (this.outstandingRequest !== void 0)
      throw new Error("Can\u2019t read while already awaiting read");
    return new Promise((resolve) => {
      this.outstandingRequest = { resolve, bytes };
      this.dequeue();
    });
  }
};

// src/util/array.ts
function concat(...arrs) {
  if (arrs.length === 1 && arrs[0] instanceof Uint8Array)
    return arrs[0];
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
  if (aLength !== b.length)
    return false;
  for (let i = 0; i < aLength; i++)
    if (a[i] !== b[i])
      return false;
  return true;
}

// src/presentation/appearance.ts
var indentChars = "\xB7\xB7 ";

// src/util/bytes.ts
var txtEnc = new TextEncoder();
var txtDec = new TextDecoder();
var Bytes = class {
  offset;
  dataView;
  data;
  comments;
  indents;
  indent;
  constructor(arrayOrMaxBytes) {
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
    if (comment)
      this.comment(comment);
    return this;
  }
  comment(s, offset = this.offset) {
    if (false)
      throw new Error("No comments should be emitted outside of chatty mode");
    const existing = this.comments[offset];
    const result = (existing === void 0 ? "" : existing + " ") + s;
    this.comments[offset] = result;
    return this;
  }
  readBytes(length) {
    return this.data.slice(this.offset, this.offset += length);
  }
  readUTF8String(length) {
    const bytes = this.subarray(length);
    const s = txtDec.decode(bytes);
    this.comment('"' + s.replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"');
    return s;
  }
  readUTF8StringNullTerminated() {
    let endOffset = this.offset;
    while (this.data[endOffset] !== 0)
      endOffset++;
    const str = this.readUTF8String(endOffset - this.offset);
    this.expectUint8(0, "end of string");
    return str;
  }
  readUint8(comment) {
    const result = this.dataView.getUint8(this.offset);
    this.offset += 1;
    if (comment)
      this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  readUint16(comment) {
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    if (comment)
      this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  readUint24(comment) {
    const msb = this.readUint8();
    const lsbs = this.readUint16();
    const result = (msb << 16) + lsbs;
    if (comment)
      this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  readUint32(comment) {
    const result = this.dataView.getUint32(this.offset);
    this.offset += 4;
    if (comment)
      this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  expectBytes(expected, comment) {
    const actual = this.readBytes(expected.length);
    if (comment)
      this.comment(comment);
    if (!equal(actual, expected))
      throw new Error(`Unexpected bytes`);
  }
  expectUint8(expectedValue, comment) {
    const actualValue = this.readUint8();
    if (comment)
      this.comment(comment);
    if (actualValue !== expectedValue)
      throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectUint16(expectedValue, comment) {
    const actualValue = this.readUint16();
    if (comment)
      this.comment(comment);
    if (actualValue !== expectedValue)
      throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectUint24(expectedValue, comment) {
    const actualValue = this.readUint24();
    if (comment)
      this.comment(comment);
    if (actualValue !== expectedValue)
      throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectUint32(expectedValue, comment) {
    const actualValue = this.readUint32();
    if (comment)
      this.comment(comment);
    if (actualValue !== expectedValue)
      throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectLength(length, indentDelta = 1) {
    const startOffset = this.offset;
    const endOffset = startOffset + length;
    if (endOffset > this.data.length)
      throw new Error("Expected length exceeds remaining data length");
    this.indent += indentDelta;
    this.indents[startOffset] = this.indent;
    return [
      () => {
        this.indent -= indentDelta;
        this.indents[this.offset] = this.indent;
        if (this.offset !== endOffset)
          throw new Error(`${length} bytes expected but ${this.offset - startOffset} read`);
      },
      () => endOffset - this.offset
    ];
  }
  expectLengthUint8(comment) {
    const length = this.readUint8();
    this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} follow`);
    return this.expectLength(length);
  }
  expectLengthUint16(comment) {
    const length = this.readUint16();
    this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} follow`);
    return this.expectLength(length);
  }
  expectLengthUint24(comment) {
    const length = this.readUint24();
    this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} follow`);
    return this.expectLength(length);
  }
  expectLengthUint32(comment) {
    const length = this.readUint32();
    this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} follow`);
    return this.expectLength(length);
  }
  expectLengthUint8Incl(comment) {
    const length = this.readUint8();
    this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} start here`);
    return this.expectLength(length - 1);
  }
  expectLengthUint16Incl(comment) {
    const length = this.readUint16();
    this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} start here`);
    return this.expectLength(length - 2);
  }
  expectLengthUint24Incl(comment) {
    const length = this.readUint24();
    this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} start here`);
    return this.expectLength(length - 3);
  }
  expectLengthUint32Incl(comment) {
    const length = this.readUint32();
    this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} start here`);
    return this.expectLength(length - 4);
  }
  writeBytes(bytes) {
    this.data.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }
  writeUTF8String(s) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    this.comment('"' + s.replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"');
    return this;
  }
  writeUTF8StringNullTerminated(s) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    this.comment('"' + s.replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"');
    this.writeUint8(0);
    this.comment("end of string");
    return this;
  }
  writeUint8(value, comment) {
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
    if (comment)
      this.comment(comment);
    return this;
  }
  writeUint16(value, comment) {
    this.dataView.setUint16(this.offset, value);
    this.offset += 2;
    if (comment)
      this.comment(comment);
    return this;
  }
  writeUint32(value, comment) {
    this.dataView.setUint32(this.offset, value);
    this.offset += 4;
    if (comment)
      this.comment(comment);
    return this;
  }
  _writeLengthGeneric(lengthBytes, inclusive, comment) {
    const startOffset = this.offset;
    this.offset += lengthBytes;
    const endOffset = this.offset;
    this.indent += 1;
    this.indents[endOffset] = this.indent;
    return () => {
      const length = this.offset - (inclusive ? startOffset : endOffset);
      if (lengthBytes === 1)
        this.dataView.setUint8(startOffset, length);
      else if (lengthBytes === 2)
        this.dataView.setUint16(startOffset, length);
      else if (lengthBytes === 3) {
        this.dataView.setUint8(startOffset, (length & 16711680) >> 16);
        this.dataView.setUint16(startOffset + 1, length & 65535);
      } else if (lengthBytes === 4)
        this.dataView.setUint32(startOffset, length);
      else
        throw new Error(`Invalid length for length field: ${lengthBytes}`);
      this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} ${inclusive ? "start here" : "follow"}`, endOffset);
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
      if (this.indents[i + 1] !== void 0)
        indent = this.indents[i + 1];
      if (comment)
        s += ` ${comment}
${indentChars.repeat(indent)}`;
    }
    return s;
  }
};

// src/presentation/highlights.ts
var regex = new RegExp(`  .+|^(${indentChars})+`, "gm");
function highlightBytes(s, colour) {
  const css = [];
  s = s.replace(regex, (m) => {
    css.push(m.startsWith(indentChars) ? "color: #ddd" : `color: ${colour}`, "color: inherit");
    return `%c${m}%c`;
  });
  return [s, ...css];
}
function highlightColonList(s) {
  const css = [];
  s = s.replace(/^[^:]+:.*$/gm, (m) => {
    const colonIndex = m.indexOf(":");
    css.push("color: #aaa", "color: inherit");
    return `%c${m.slice(0, colonIndex + 1)}%c${m.slice(colonIndex + 1)}`;
  });
  return [s, ...css];
}

// src/presentation/log.ts
var element = document.querySelector("#logs");
var escapes = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;"
};
var regexp = new RegExp("[" + Object.keys(escapes).join("") + "]", "g");
function htmlEscape(s) {
  return s.replace(regexp, (match) => escapes[match]);
}
function htmlFromLogArgs(...args) {
  let result = "<span>", arg, matchArr, separator = "";
  while ((arg = args.shift()) !== void 0) {
    arg = separator + htmlEscape(String(arg));
    separator = " ";
    const formatRegExp = /([\s\S]*?)%([csoOidf])|[\s\S]+/g;
    while ((matchArr = formatRegExp.exec(arg)) !== null) {
      const [whole, literal, sub] = matchArr;
      if (sub === void 0) {
        result += whole;
      } else {
        result += literal;
        if (sub === "c") {
          result += `</span><span style="${args.shift()}">`;
        } else if (sub === "s") {
          result += args.shift();
        } else if (sub === "o" || sub === "O") {
          result += JSON.stringify(args.shift(), void 0, sub === "O" ? 2 : void 0);
        } else if (sub === "i" || sub === "d" || sub === "f") {
          result += String(args.shift());
        }
      }
    }
  }
  result += "</span>";
  return result;
}
function log(...args) {
  console.log(...args);
  element.innerHTML += '<label><input type="checkbox"><div class="section">' + htmlFromLogArgs(...args) + "</div></label>";
  document.body.scrollTo({ top: 999999 });
}

// src/tls/makeClientHello.ts
function makeClientHello(host, publicKey, sessionId, useSNI = true) {
  const h = new Bytes(1024);
  h.writeUint8(22);
  h.comment("record type: handshake");
  h.writeUint16(769);
  h.comment("TLS protocol version 1.0");
  const endRecordHeader = h.writeLengthUint16();
  h.writeUint8(1);
  h.comment("handshake type: client hello");
  const endHandshakeHeader = h.writeLengthUint24();
  h.writeUint16(771);
  h.comment("TLS version 1.2 (middlebox compatibility)");
  crypto.getRandomValues(h.subarray(32));
  h.comment("client random");
  const endSessionId = h.writeLengthUint8("session ID");
  h.writeBytes(sessionId);
  h.comment("session ID (middlebox compatibility)");
  endSessionId();
  const endCiphers = h.writeLengthUint16("ciphers");
  h.writeUint16(4865);
  h.comment("cipher: TLS_AES_128_GCM_SHA256");
  endCiphers();
  const endCompressionMethods = h.writeLengthUint8("compression methods");
  h.writeUint8(0);
  h.comment("compression method: none");
  endCompressionMethods();
  const endExtensions = h.writeLengthUint16("extensions");
  if (useSNI) {
    h.writeUint16(0);
    h.comment("extension type: SNI");
    const endSNIExt = h.writeLengthUint16("SNI data");
    const endSNI = h.writeLengthUint16("SNI records");
    h.writeUint8(0);
    h.comment("list entry type: DNS hostname");
    const endHostname = h.writeLengthUint16("hostname");
    h.writeUTF8String(host);
    endHostname();
    endSNI();
    endSNIExt();
  }
  h.writeUint16(11);
  h.comment("extension type: EC point formats");
  const endFormatTypesExt = h.writeLengthUint16("formats data");
  const endFormatTypes = h.writeLengthUint8("formats");
  h.writeUint8(0);
  h.comment("format: uncompressed");
  endFormatTypes();
  endFormatTypesExt();
  h.writeUint16(10);
  h.comment("extension type: supported groups (curves)");
  const endGroupsExt = h.writeLengthUint16("groups data");
  const endGroups = h.writeLengthUint16("groups");
  h.writeUint16(23);
  h.comment("curve secp256r1 (NIST P-256)");
  endGroups();
  endGroupsExt();
  h.writeUint16(13);
  h.comment("extension type: signature algorithms");
  const endSigsExt = h.writeLengthUint16("signature algorithms data");
  const endSigs = h.writeLengthUint16("signature algorithms");
  h.writeUint16(1027);
  h.comment("ecdsa_secp256r1_sha256");
  h.writeUint16(2052);
  h.comment("rsa_pss_rsae_sha256");
  endSigs();
  endSigsExt();
  h.writeUint16(43);
  h.comment("extension type: supported TLS versions");
  const endVersionsExt = h.writeLengthUint16("TLS versions data");
  const endVersions = h.writeLengthUint8("TLS versions");
  h.writeUint16(772);
  h.comment("TLS version 1.3");
  endVersions();
  endVersionsExt();
  h.writeUint16(51);
  h.comment("extension type: key share");
  const endKeyShareExt = h.writeLengthUint16("key share data");
  const endKeyShares = h.writeLengthUint16("key shares");
  h.writeUint16(23);
  h.comment("secp256r1 (NIST P-256) key share");
  const endKeyShare = h.writeLengthUint16("key share");
  h.writeBytes(new Uint8Array(publicKey));
  h.comment("key");
  endKeyShare();
  endKeyShares();
  endKeyShareExt();
  endExtensions();
  endHandshakeHeader();
  endRecordHeader();
  return h;
}

// src/util/hex.ts
function hexFromU8(u8, spacer = "") {
  return [...u8].map((n) => n.toString(16).padStart(2, "0")).join(spacer);
}

// src/tls/parseServerHello.ts
function parseServerHello(hello, sessionId) {
  let serverPublicKey;
  let tlsVersionSpecified;
  const [endServerHelloMessage] = hello.expectLength(hello.remaining());
  hello.expectUint8(2, "handshake type: server hello");
  const [endServerHello] = hello.expectLengthUint24("server hello");
  hello.expectUint16(771, "TLS version 1.2 (middlebox compatibility)");
  const serverRandom = hello.readBytes(32);
  if (equal(serverRandom, [
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
  ]))
    throw new Error("Unexpected HelloRetryRequest");
  hello.comment('server random \u2014 not SHA256("HelloRetryRequest")');
  hello.expectUint8(sessionId.length, "session ID length (matches client session ID)");
  hello.expectBytes(sessionId, "session ID (matches client session ID)");
  hello.expectUint16(4865, "cipher (matches client hello)");
  hello.expectUint8(0, "no compression");
  const [endExtensions, extensionsRemaining] = hello.expectLengthUint16("extensions");
  while (extensionsRemaining() > 0) {
    const extensionType = hello.readUint16("extension type");
    const [endExtension] = hello.expectLengthUint16("extension");
    if (extensionType === 43) {
      hello.expectUint16(772, "TLS version 1.3");
      tlsVersionSpecified = true;
    } else if (extensionType === 51) {
      hello.expectUint16(23, "secp256r1 (NIST P-256) key share");
      hello.expectUint16(65);
      serverPublicKey = hello.readBytes(65);
      hello.comment("key");
    } else {
      throw new Error(`Unexpected extension 0x${hexFromU8([extensionType])}`);
    }
    endExtension();
  }
  endExtensions();
  endServerHello();
  endServerHelloMessage();
  if (tlsVersionSpecified !== true)
    throw new Error("No TLS version provided");
  if (serverPublicKey === void 0)
    throw new Error("No key provided");
  return serverPublicKey;
}

// src/tls/tlsRecord.ts
var RecordTypeName = {
  20: "ChangeCipherSpec",
  21: "Alert",
  22: "Handshake",
  23: "Application",
  24: "Heartbeat"
};
var maxPlaintextRecordLength = 1 << 14;
var maxCiphertextRecordLength = maxPlaintextRecordLength + 1 + 255;
async function readTlsRecord(read, expectedType, maxLength = maxPlaintextRecordLength) {
  const headerLength = 5;
  const headerData = await read(headerLength);
  if (headerData === void 0)
    return;
  if (headerData.length < headerLength)
    throw new Error("TLS record header truncated");
  const header = new Bytes(headerData);
  const type = header.readUint8();
  if (type < 20 || type > 24)
    throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  if (expectedType !== void 0 && type !== expectedType)
    throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, "0")} (expected 0x${expectedType.toString(16).padStart(2, "0")})`);
  header.comment(`record type: ${RecordTypeName[type]}`);
  const version = header.readUint16("TLS version");
  if ([769, 770, 771].indexOf(version) < 0)
    throw new Error(`Unsupported TLS record version 0x${version.toString(16).padStart(4, "0")}`);
  const length = header.readUint16("% bytes of TLS record follow");
  if (length > maxLength)
    throw new Error(`Record too long: ${length} bytes`);
  const content = await read(length);
  if (content === void 0 || content.length < length)
    throw new Error("TLS record content truncated");
  return { headerData, header, type, version, length, content };
}
async function readEncryptedTlsRecord(read, decrypter, expectedType) {
  const encryptedRecord = await readTlsRecord(read, 23 /* Application */, maxCiphertextRecordLength);
  if (encryptedRecord === void 0)
    return;
  const encryptedBytes = new Bytes(encryptedRecord.content);
  const [endEncrypted] = encryptedBytes.expectLength(encryptedBytes.remaining());
  encryptedBytes.skip(encryptedRecord.length - 16, "encrypted payload");
  encryptedBytes.skip(16, "auth tag");
  endEncrypted();
  log(...highlightBytes(encryptedRecord.header.commentedString() + encryptedBytes.commentedString(), "#88c" /* server */));
  const decryptedRecord = await decrypter.process(encryptedRecord.content, 16, encryptedRecord.headerData);
  let recordTypeIndex = decryptedRecord.length - 1;
  while (decryptedRecord[recordTypeIndex] === 0)
    recordTypeIndex -= 1;
  if (recordTypeIndex < 0)
    throw new Error("Decrypted message has no record type indicator (all zeroes)");
  const type = decryptedRecord[recordTypeIndex];
  const record = decryptedRecord.subarray(0, recordTypeIndex);
  if (type === 21 /* Alert */) {
    const closeNotify = record.length === 2 && record[0] === 1 && record[1] === 0;
    log(`%cTLS 0x15 alert record: ${hexFromU8(record, " ")}` + (closeNotify ? " (close notify)" : ""), `color: ${"#c88" /* header */}`);
    if (closeNotify)
      return void 0;
  }
  if (type === 22 /* Handshake */ && record[0] === 4) {
    log(...highlightBytes(hexFromU8(record, " ") + "  session ticket message: ignored", "#88c" /* server */));
    return readEncryptedTlsRecord(read, decrypter, expectedType);
  }
  if (expectedType !== void 0 && type !== expectedType)
    throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, "0")} (expected 0x${expectedType.toString(16).padStart(2, "0")})`);
  log(`... decrypted payload (see below) ... %s%c  %s`, type.toString(16).padStart(2, "0"), `color: ${"#88c" /* server */}`, `actual decrypted record type: ${RecordTypeName[type]}`);
  return record;
}
async function makeEncryptedTlsRecord(plaintext, encrypter, type) {
  const data = concat(plaintext, [type]);
  const headerLength = 5;
  const dataLength = data.length;
  const authTagLength = 16;
  const payloadLength = dataLength + authTagLength;
  const encryptedRecord = new Bytes(headerLength + payloadLength);
  encryptedRecord.writeUint8(23, "record type: Application (middlebox compatibility)");
  encryptedRecord.writeUint16(771, "TLS version 1.2 (middlebox compatibility)");
  encryptedRecord.writeUint16(payloadLength, `${payloadLength} bytes follow`);
  const [endEncryptedRecord] = encryptedRecord.expectLength(payloadLength);
  const header = encryptedRecord.array();
  const encryptedData = await encrypter.process(data, 16, header);
  encryptedRecord.writeBytes(encryptedData.subarray(0, encryptedData.length - 16));
  encryptedRecord.comment("encrypted data");
  encryptedRecord.writeBytes(encryptedData.subarray(encryptedData.length - 16));
  encryptedRecord.comment("auth tag");
  endEncryptedRecord();
  log(...highlightBytes(encryptedRecord.commentedString(), "#8cc" /* client */));
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

// src/tls/keys.ts
var txtEnc2 = new TextEncoder();
async function hkdfExtract(salt, keyMaterial, hashBits) {
  const hmacKey = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: { name: `SHA-${hashBits}` } }, false, ["sign"]);
  var prk = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, keyMaterial));
  return prk;
}
async function hkdfExpand(key, info, length, hashBits) {
  const hashBytes = hashBits >> 3;
  const n = Math.ceil(length / hashBytes);
  const okm = new Uint8Array(n * hashBytes);
  const hmacKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: { name: `SHA-${hashBits}` } }, false, ["sign"]);
  let tPrev = new Uint8Array(0);
  for (let i = 0; i < n; i++) {
    const hmacData = concat(tPrev, info, [i + 1]);
    const tiBuffer = await crypto.subtle.sign("HMAC", hmacKey, hmacData);
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
async function getHandshakeKeys(serverPublicKey, privateKey, hellos, hashBits, keyLength) {
  const hashBytes = hashBits >> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const publicKey = await crypto.subtle.importKey("raw", serverPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecretBuffer = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  log(...highlightColonList("shared secret: " + hexFromU8(sharedSecret)));
  const hellosHashBuffer = await crypto.subtle.digest("SHA-256", hellos);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  log(...highlightColonList("hellos hash: " + hexFromU8(hellosHash)));
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashBits);
  log(...highlightColonList("early secret: " + hexFromU8(new Uint8Array(earlySecret))));
  const emptyHashBuffer = await crypto.subtle.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  log(...highlightColonList("empty hash: " + hexFromU8(emptyHash)));
  const derivedSecret = await hkdfExpandLabel(earlySecret, "derived", emptyHash, hashBytes, hashBits);
  log(...highlightColonList("derived secret: " + hexFromU8(derivedSecret)));
  const handshakeSecret = await hkdfExtract(derivedSecret, sharedSecret, hashBits);
  log(...highlightColonList("handshake secret: " + hexFromU8(handshakeSecret)));
  const clientSecret = await hkdfExpandLabel(handshakeSecret, "c hs traffic", hellosHash, hashBytes, hashBits);
  log(...highlightColonList("client secret: " + hexFromU8(clientSecret)));
  const serverSecret = await hkdfExpandLabel(handshakeSecret, "s hs traffic", hellosHash, hashBytes, hashBits);
  log(...highlightColonList("server secret: " + hexFromU8(serverSecret)));
  const clientHandshakeKey = await hkdfExpandLabel(clientSecret, "key", new Uint8Array(0), keyLength, hashBits);
  log(...highlightColonList("client handshake key: " + hexFromU8(clientHandshakeKey)));
  const serverHandshakeKey = await hkdfExpandLabel(serverSecret, "key", new Uint8Array(0), keyLength, hashBits);
  log(...highlightColonList("server handshake key: " + hexFromU8(serverHandshakeKey)));
  const clientHandshakeIV = await hkdfExpandLabel(clientSecret, "iv", new Uint8Array(0), 12, hashBits);
  log(...highlightColonList("client handshake iv: " + hexFromU8(clientHandshakeIV)));
  const serverHandshakeIV = await hkdfExpandLabel(serverSecret, "iv", new Uint8Array(0), 12, hashBits);
  log(...highlightColonList("server handshake iv: " + hexFromU8(serverHandshakeIV)));
  return { serverHandshakeKey, serverHandshakeIV, clientHandshakeKey, clientHandshakeIV, handshakeSecret, clientSecret, serverSecret };
}
async function getApplicationKeys(handshakeSecret, handshakeHash, hashBits, keyLength) {
  const hashBytes = hashBits >> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const emptyHashBuffer = await crypto.subtle.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  log(...highlightColonList("empty hash: " + hexFromU8(emptyHash)));
  const derivedSecret = await hkdfExpandLabel(handshakeSecret, "derived", emptyHash, hashBytes, hashBits);
  log(...highlightColonList("derived secret: " + hexFromU8(derivedSecret)));
  const masterSecret = await hkdfExtract(derivedSecret, zeroKey, hashBits);
  log(...highlightColonList("master secret: " + hexFromU8(masterSecret)));
  const clientSecret = await hkdfExpandLabel(masterSecret, "c ap traffic", handshakeHash, hashBytes, hashBits);
  log(...highlightColonList("client secret: " + hexFromU8(clientSecret)));
  const serverSecret = await hkdfExpandLabel(masterSecret, "s ap traffic", handshakeHash, hashBytes, hashBits);
  log(...highlightColonList("server secret: " + hexFromU8(serverSecret)));
  const clientApplicationKey = await hkdfExpandLabel(clientSecret, "key", new Uint8Array(0), keyLength, hashBits);
  log(...highlightColonList("client application key: " + hexFromU8(clientApplicationKey)));
  const serverApplicationKey = await hkdfExpandLabel(serverSecret, "key", new Uint8Array(0), keyLength, hashBits);
  log(...highlightColonList("server application key: " + hexFromU8(serverApplicationKey)));
  const clientApplicationIV = await hkdfExpandLabel(clientSecret, "iv", new Uint8Array(0), 12, hashBits);
  log(...highlightColonList("client application iv: " + hexFromU8(clientApplicationIV)));
  const serverApplicationIV = await hkdfExpandLabel(serverSecret, "iv", new Uint8Array(0), 12, hashBits);
  log(...highlightColonList("server application iv: " + hexFromU8(serverApplicationIV)));
  return { serverApplicationKey, serverApplicationIV, clientApplicationKey, clientApplicationIV };
}

// src/tls/aesgcm.ts
var maxRecords = 1 << 30;
var Crypter = class {
  mode;
  key;
  initialIv;
  ivLength;
  currentIv;
  currentIvDataView;
  initialIvLast32;
  recordsDecrypted = 0;
  constructor(mode, key, initialIv) {
    this.mode = mode;
    this.key = key;
    this.initialIv = initialIv;
    this.ivLength = initialIv.length;
    this.currentIv = initialIv.slice();
    this.currentIvDataView = new DataView(this.currentIv.buffer, this.currentIv.byteOffset, this.currentIv.byteLength);
    this.initialIvLast32 = this.currentIvDataView.getUint32(this.ivLength - 4);
  }
  async process(data, authTagLength, additionalData) {
    if (this.recordsDecrypted === maxRecords)
      throw new Error("Cannot encrypt/decrypt any more records");
    const currentIvLast32 = this.initialIvLast32 ^ this.recordsDecrypted;
    this.currentIvDataView.setUint32(this.ivLength - 4, currentIvLast32);
    this.recordsDecrypted += 1;
    const authTagBits = authTagLength << 3;
    const algorithm = { name: "AES-GCM", iv: this.currentIv, tagLength: authTagBits, additionalData };
    const resultBuffer = await crypto.subtle[this.mode](algorithm, this.key, data);
    const result = new Uint8Array(resultBuffer);
    return result;
  }
};

// src/util/base64.ts
function charCodeMap(charCode) {
  return charCode > 64 && charCode < 91 ? charCode - 65 : charCode > 96 && charCode < 123 ? charCode - 71 : charCode > 47 && charCode < 58 ? charCode + 4 : charCode === 43 ? 62 : charCode === 47 ? 63 : charCode === 61 ? 64 : void 0;
}
function base64Decode(input) {
  const len = input.length;
  let inputIdx = 0, outputIdx = 0;
  let enc1 = 64, enc2 = 64, enc3 = 64, enc4 = 64;
  const output = new Uint8Array(len * 0.75);
  while (inputIdx < len) {
    enc1 = charCodeMap(input.charCodeAt(inputIdx++));
    enc2 = charCodeMap(input.charCodeAt(inputIdx++));
    enc3 = charCodeMap(input.charCodeAt(inputIdx++));
    enc4 = charCodeMap(input.charCodeAt(inputIdx++));
    output[outputIdx++] = enc1 << 2 | enc2 >> 4;
    output[outputIdx++] = (enc2 & 15) << 4 | enc3 >> 2;
    output[outputIdx++] = (enc3 & 3) << 6 | enc4;
  }
  const excessLength = enc2 === 64 ? 0 : enc3 === 64 ? 2 : enc4 === 64 ? 1 : 0;
  return output.subarray(0, outputIdx - excessLength);
}

// src/util/asn1bytes.ts
var ASN1Bytes = class extends Bytes {
  readASN1Length(comment) {
    const byte1 = this.readUint8();
    if (byte1 < 128) {
      this.comment(`${byte1} bytes${comment ? ` of ${comment}` : ""} follow (ASN.1)`);
      return byte1;
    }
    const lengthBytes = byte1 & 127;
    const fullComment = `% bytes${comment ? ` of ${comment}` : ""} follow (ASN.1)`;
    if (lengthBytes === 1)
      return this.readUint8(fullComment);
    if (lengthBytes === 2)
      return this.readUint16(fullComment);
    if (lengthBytes === 3)
      return this.readUint24(fullComment);
    if (lengthBytes === 4)
      return this.readUint32(fullComment);
    throw new Error(`ASN.1 length fields are only supported up to 4 bytes (this one is ${lengthBytes} bytes)`);
  }
  expectASN1Length(comment) {
    const length = this.readASN1Length(comment);
    return this.expectLength(length);
  }
  readASN1OID() {
    const [endOID, OIDRemaining] = this.expectASN1Length("OID");
    const byte1 = this.readUint8();
    let oid = `${Math.floor(byte1 / 40)}.${byte1 % 40}`;
    while (OIDRemaining() > 0) {
      let value = 0;
      while (true) {
        const nextByte = this.readUint8();
        value <<= 7;
        value += nextByte & 127;
        if (nextByte < 128)
          break;
      }
      oid += `.${value}`;
    }
    this.comment(oid);
    endOID();
    return oid;
  }
  readASN1Boolean() {
    const [endBoolean, booleanRemaining] = this.expectASN1Length("boolean");
    const length = booleanRemaining();
    if (length !== 1)
      throw new Error(`Boolean has weird length: ${length}`);
    const byte = this.readUint8();
    let result;
    if (byte === 255)
      result = true;
    else if (byte === 0)
      result = false;
    else
      throw new Error(`Boolean has weird value: 0x${hexFromU8([byte])}`);
    this.comment(result.toString());
    endBoolean();
    return result;
  }
  readASN1UTCTime() {
    const [endTime, timeRemaining] = this.expectASN1Length("UTC time");
    const timeStr = this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
    if (!parts)
      throw new Error("Unrecognised UTC time format in certificate validity");
    const [, yr2dstr, mth, dy, hr, min, sec] = parts;
    const yr2d = parseInt(yr2dstr, 10);
    const yr = yr2d + (yr2d >= 50 ? 1900 : 2e3);
    const time = new Date(`${yr}-${mth}-${dy}T${hr}:${min}:${sec}Z`);
    this.comment("= " + time.toISOString());
    endTime();
    return time;
  }
  readASN1BitString() {
    const [endBitString, bitStringRemaining] = this.expectASN1Length("bit string");
    const rightPadBits = this.readUint8("right-padding bits");
    const bytesLength = bitStringRemaining();
    const bitString = this.readBytes(bytesLength);
    if (rightPadBits > 7)
      throw new Error(`Invalid right pad value: ${rightPadBits}`);
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
var universalTypeUTF8String = 12;
var universalTypeUTCTime = 23;
var universalTypeNull = 5;
var universalTypeOctetString = 4;
var universalTypeBitString = 3;
var constructedContextSpecificType = 163;
var contextSpecificType = 128;
var DNOIDMap = {
  "2.5.4.6": "C",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.3": "CN",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.12": "T",
  "2.5.4.42": "GN",
  "2.5.4.43": "I",
  "2.5.4.4": "SN",
  "1.2.840.113549.1.9.1": "E-mail"
};
var keyOIDMap = {
  "1.2.840.10045.2.1": "ECPublicKey",
  "1.2.840.10045.3.1.7": "secp256r1",
  "1.3.132.0.34": "secp384r1",
  "1.2.840.113549.1.1.1": "RSAES-PKCS1-v1_5"
};
var extOIDMap = {
  "2.5.29.15": "KeyUsage",
  "2.5.29.37": "ExtKeyUsage",
  "2.5.29.19": "BasicConstraints",
  "2.5.29.14": "SubjectKeyIdentifier",
  "2.5.29.35": "AuthorityKeyIdentifier",
  "1.3.6.1.5.5.7.1.1": "AuthorityInfoAccess",
  "2.5.29.17": "SubjectAltName",
  "2.5.29.32": "CertificatePolicies",
  "1.3.6.1.4.1.11129.2.4.2": "SignedCertificateTimestampList",
  "2.5.29.31": "CRLDistributionPoints"
};
var extKeyUsageOIDMap = {
  "1.3.6.1.5.5.7.3.2": "TLSCLientAuth",
  "1.3.6.1.5.5.7.3.1": "TLSServerAuth"
};
function intFromBitString(bs) {
  const { length } = bs;
  if (length > 4)
    throw new Error(`Bit string length ${length} would overflow JS bit operators`);
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
  cb.expectUint8(constructedUniversalTypeSequence, `sequence (${seqType})`);
  const [endSeq, seqRemaining] = cb.expectASN1Length("sequence");
  while (seqRemaining() > 0) {
    cb.expectUint8(constructedUniversalTypeSet, "set");
    const [endItemSet] = cb.expectASN1Length("set");
    cb.expectUint8(constructedUniversalTypeSequence, "sequence");
    const [endItemSeq] = cb.expectASN1Length("sequence");
    cb.expectUint8(universalTypeOID, "OID");
    const itemOID = cb.readASN1OID();
    const itemName = DNOIDMap[itemOID] ?? itemOID;
    cb.comment(`= ${itemName}`);
    const valueType = cb.readUint8();
    if (valueType === universalTypePrintableString) {
      cb.comment("printable string");
    } else if (valueType === universalTypeUTF8String) {
      cb.comment("UTF8 string");
    } else {
      throw new Error(`Unexpected item type in certificate ${seqType}: 0x${hexFromU8([valueType])}`);
    }
    const [endItemString, itemStringRemaining] = cb.expectASN1Length("UTF8 string");
    const itemValue = cb.readUTF8String(itemStringRemaining());
    endItemString();
    endItemSeq();
    endItemSet();
    if (result[itemName] !== void 0)
      throw new Error(`Duplicate OID ${itemName} in certificate ${seqType}`);
    result[itemName] = itemValue;
  }
  endSeq();
  return result;
}
function readNamesSeq(cb, typeUnionBits = 0) {
  const names = [];
  const [endNamesSeq, namesSeqRemaining] = cb.expectASN1Length("names sequence");
  while (namesSeqRemaining() > 0) {
    const type = cb.readUint8("GeneralNames type");
    const [endName, nameRemaining] = cb.expectASN1Length("name");
    let name;
    if (type === (typeUnionBits | 2 /* dNSName */)) {
      name = cb.readUTF8String(nameRemaining());
      cb.comment("= DNS name");
    } else {
      name = cb.readBytes(nameRemaining());
      cb.comment(`= name (type 0x${hexFromU8([type])})`);
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
      name: "ECDSA",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.10045.4.1": {
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
  if (algo === void 0)
    throw new Error(`Unsupported algorithm identifier: ${oid}`);
  return algo;
}
function _descriptionForAlgorithm(algo, desc = []) {
  Object.values(algo).forEach((value) => {
    if (typeof value === "string")
      desc = [...desc, value];
    else
      desc = _descriptionForAlgorithm(value, desc);
  });
  return desc;
}
function descriptionForAlgorithm(algo) {
  return _descriptionForAlgorithm(algo).join(" / ");
}

// src/tls/cert.ts
var allKeyUsages = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "cRLSign",
  "encipherOnly",
  "decipherOnly"
];
var Cert = class {
  serialNumber;
  algorithm;
  issuer;
  validityPeriod;
  subject;
  publicKey;
  signature;
  keyUsage;
  subjectAltNames;
  extKeyUsage;
  authorityKeyIdentifier;
  subjectKeyIdentifier;
  basicConstraints;
  signedData;
  constructor(certData) {
    const cb = certData instanceof ASN1Bytes ? certData : new ASN1Bytes(certData);
    cb.expectUint8(constructedUniversalTypeSequence, "sequence (certificate)");
    const [endCertSeq] = cb.expectASN1Length("certificate sequence");
    const tbsCertStartOffset = cb.offset;
    cb.expectUint8(constructedUniversalTypeSequence, "sequence (certificate info)");
    const [endCertInfoSeq] = cb.expectASN1Length("certificate info");
    cb.expectBytes([160, 3, 2, 1, 2], "certificate version v3");
    cb.expectUint8(universalTypeInteger, "integer");
    const [endSerialNumber, serialNumberRemaining] = cb.expectASN1Length("serial number");
    this.serialNumber = cb.subarray(serialNumberRemaining());
    cb.comment("serial number");
    endSerialNumber();
    cb.expectUint8(constructedUniversalTypeSequence, "sequence (algorithm)");
    const [endAlgo, algoRemaining] = cb.expectASN1Length("algorithm sequence");
    cb.expectUint8(universalTypeOID, "OID");
    this.algorithm = cb.readASN1OID();
    cb.comment(`= ${descriptionForAlgorithm(algorithmWithOID(this.algorithm))}`);
    if (algoRemaining() > 0) {
      cb.expectUint8(universalTypeNull, "null");
      cb.expectUint8(0, "null length");
    }
    endAlgo();
    this.issuer = readSeqOfSetOfSeq(cb, "issuer");
    cb.expectUint8(constructedUniversalTypeSequence, "sequence (validity)");
    const [endValiditySeq] = cb.expectASN1Length("validity sequence");
    cb.expectUint8(universalTypeUTCTime, "UTC time (not before)");
    const notBefore = cb.readASN1UTCTime();
    cb.expectUint8(universalTypeUTCTime, "UTC time (not after)");
    const notAfter = cb.readASN1UTCTime();
    this.validityPeriod = { notBefore, notAfter };
    endValiditySeq();
    this.subject = readSeqOfSetOfSeq(cb, "subject");
    const publicKeyStartOffset = cb.offset;
    cb.expectUint8(constructedUniversalTypeSequence, "sequence (public key)");
    const [endPublicKeySeq] = cb.expectASN1Length("public key sequence");
    cb.expectUint8(constructedUniversalTypeSequence, "sequence (public key params)");
    const [endKeyOID, keyOIDRemaining] = cb.expectASN1Length("public key params sequence");
    const publicKeyOIDs = [];
    while (keyOIDRemaining() > 0) {
      const keyParamRecordType = cb.readUint8();
      if (keyParamRecordType === universalTypeOID) {
        cb.comment("OID");
        const keyOID = cb.readASN1OID();
        publicKeyOIDs.push(keyOID);
        cb.comment(`= ${keyOIDMap[keyOID]}`);
      } else if (keyParamRecordType === universalTypeNull) {
        cb.comment("null");
        cb.expectUint8(0, "null length");
      }
    }
    endKeyOID();
    cb.expectUint8(universalTypeBitString, "bit string");
    const publicKeyData = cb.readASN1BitString();
    cb.comment("public key");
    this.publicKey = { identifiers: publicKeyOIDs, data: publicKeyData, all: cb.data.subarray(publicKeyStartOffset, cb.offset) };
    endPublicKeySeq();
    cb.expectUint8(constructedContextSpecificType, "constructed context-specific type");
    const [endExtsData] = cb.expectASN1Length();
    cb.expectUint8(constructedUniversalTypeSequence, "sequence (extensions)");
    const [endExts, extsRemaining] = cb.expectASN1Length("extensions sequence");
    while (extsRemaining() > 0) {
      cb.expectUint8(constructedUniversalTypeSequence, "sequence");
      const [endExt, extRemaining] = cb.expectASN1Length();
      cb.expectUint8(universalTypeOID, "OID (extension type)");
      const extOID = cb.readASN1OID();
      cb.comment(`= ${extOIDMap[extOID]}`);
      if (extOID === "2.5.29.17") {
        cb.expectUint8(universalTypeOctetString, "octet string");
        const [endSanDerDoc] = cb.expectASN1Length("DER document");
        cb.expectUint8(constructedUniversalTypeSequence, "sequence (names)");
        const allSubjectAltNames = readNamesSeq(cb, contextSpecificType);
        this.subjectAltNames = allSubjectAltNames.filter((san) => san.type === (2 /* dNSName */ | contextSpecificType)).map((san) => san.name);
        endSanDerDoc();
      } else if (extOID === "2.5.29.15") {
        cb.expectUint8(universalTypeBoolean, "boolean");
        const keyUsageCritical = cb.readASN1Boolean();
        cb.comment("<- critical");
        cb.expectUint8(universalTypeOctetString, "octet string");
        const [endKeyUsageDer] = cb.expectASN1Length("DER document");
        cb.expectUint8(universalTypeBitString, "bit string");
        const keyUsageBitStr = cb.readASN1BitString();
        const keyUsageBitmask = intFromBitString(keyUsageBitStr);
        const keyUsageNames = new Set(allKeyUsages.filter((u, i) => keyUsageBitmask & 1 << i));
        cb.comment(`key usage: ${keyUsageBitmask} = ${[...keyUsageNames]}`);
        endKeyUsageDer();
        this.keyUsage = {
          critical: keyUsageCritical,
          usages: keyUsageNames
        };
      } else if (extOID === "2.5.29.37") {
        this.extKeyUsage = {};
        cb.expectUint8(universalTypeOctetString, "octet string");
        const [endExtKeyUsageDer] = cb.expectASN1Length("DER document");
        cb.expectUint8(constructedUniversalTypeSequence, "sequence");
        const [endExtKeyUsage, extKeyUsageRemaining] = cb.expectASN1Length("key usage OIDs");
        while (extKeyUsageRemaining() > 0) {
          cb.expectUint8(universalTypeOID, "OID");
          const extKeyUsageOID = cb.readASN1OID();
          if (extKeyUsageOID === "1.3.6.1.5.5.7.3.1")
            this.extKeyUsage.serverTls = true;
          if (extKeyUsageOID === "1.3.6.1.5.5.7.3.2")
            this.extKeyUsage.clientTls = true;
          cb.comment(`= ${extKeyUsageOIDMap[extKeyUsageOID]}`);
        }
        endExtKeyUsage();
        endExtKeyUsageDer();
      } else if (extOID === "2.5.29.35") {
        cb.expectUint8(universalTypeOctetString, "octet string");
        const [endAuthKeyIdDer] = cb.expectASN1Length("DER document");
        cb.expectUint8(constructedUniversalTypeSequence, "sequence");
        const [endAuthKeyIdSeq, authKeyIdSeqRemaining] = cb.expectASN1Length("sequence");
        while (authKeyIdSeqRemaining() > 0) {
          const authKeyIdDatumType = cb.readUint8();
          if (authKeyIdDatumType === (contextSpecificType | 0)) {
            cb.comment("context-specific type: key identifier");
            const [endAuthKeyId, authKeyIdRemaining] = cb.expectASN1Length("authority key identifier");
            this.authorityKeyIdentifier = cb.readBytes(authKeyIdRemaining());
            cb.comment("authority key identifier");
            endAuthKeyId();
          } else if (authKeyIdDatumType === (contextSpecificType | 1) || authKeyIdDatumType === (contextSpecificType | 2)) {
            cb.comment("context-specific type: authority cert issuer or authority cert serial number");
            const [endAuthKeyIdExtra, authKeyIdExtraRemaining] = cb.expectASN1Length("authority cert issuer or authority cert serial number");
            cb.skip(authKeyIdExtraRemaining(), "ignored");
            endAuthKeyIdExtra();
          } else {
            throw new Error("Unexpected data type in authorityKeyIdentifier certificate extension");
          }
        }
        endAuthKeyIdSeq();
        endAuthKeyIdDer();
      } else if (extOID === "2.5.29.14") {
        cb.expectUint8(universalTypeOctetString, "octet string");
        const [endSubjectKeyIdDer] = cb.expectASN1Length("DER document");
        cb.expectUint8(universalTypeOctetString, "octet string");
        const [endSubjectKeyId, subjectKeyIdRemaining] = cb.expectASN1Length("subject key identifier");
        this.subjectKeyIdentifier = cb.readBytes(subjectKeyIdRemaining());
        cb.comment("subject key identifier");
        endSubjectKeyId();
        endSubjectKeyIdDer();
      } else if (extOID === "2.5.29.19") {
        let basicConstraintsCritical;
        let bcNextType = cb.readUint8();
        if (bcNextType === universalTypeBoolean) {
          cb.comment("boolean");
          basicConstraintsCritical = cb.readASN1Boolean();
          cb.comment("= critical");
          bcNextType = cb.readUint8();
        }
        if (bcNextType !== universalTypeOctetString)
          throw new Error("Unexpected type in certificate basic constraints");
        cb.comment("octet string");
        const [endBasicConstraintsDer] = cb.expectASN1Length("DER document");
        cb.expectUint8(constructedUniversalTypeSequence, "sequence");
        const [endConstraintsSeq, constraintsSeqRemaining] = cb.expectASN1Length();
        let basicConstraintsCa = void 0;
        if (constraintsSeqRemaining() > 0) {
          cb.expectUint8(universalTypeBoolean, "boolean");
          basicConstraintsCa = cb.readASN1Boolean();
        }
        let basicConstraintsPathLength;
        if (constraintsSeqRemaining() > 0) {
          cb.expectUint8(universalTypeInteger, "integer");
          const maxPathLengthLength = cb.readASN1Length("max path length");
          basicConstraintsPathLength = maxPathLengthLength === 1 ? cb.readUint8() : maxPathLengthLength === 2 ? cb.readUint16() : maxPathLengthLength === 3 ? cb.readUint24() : void 0;
          if (basicConstraintsPathLength === void 0)
            throw new Error("Too many bytes in max path length in certificate basicConstraints");
          cb.comment("max path length");
        }
        endConstraintsSeq();
        endBasicConstraintsDer();
        this.basicConstraints = {
          critical: basicConstraintsCritical,
          ca: basicConstraintsCa,
          pathLength: basicConstraintsPathLength
        };
      } else {
        cb.skip(extRemaining(), "ignored extension data");
      }
      endExt();
    }
    endExts();
    endExtsData();
    endCertInfoSeq();
    this.signedData = cb.data.subarray(tbsCertStartOffset, cb.offset);
    cb.expectUint8(constructedUniversalTypeSequence, "sequence (signature algorithm)");
    const [endSigAlgo, sigAlgoRemaining] = cb.expectASN1Length("signature algorithm sequence");
    cb.expectUint8(universalTypeOID, "OID");
    const sigAlgoOID = cb.readASN1OID();
    if (sigAlgoRemaining() > 0) {
      cb.expectUint8(universalTypeNull, "null");
      cb.expectUint8(0, "null length");
    }
    endSigAlgo();
    if (sigAlgoOID !== this.algorithm)
      throw new Error(`Certificate specifies different signature algorithms inside (${this.algorithm}) and out (${sigAlgoOID})`);
    cb.expectUint8(universalTypeBitString, "bitstring (signature)");
    this.signature = cb.readASN1BitString();
    cb.comment("signature");
    endCertSeq();
  }
  static fromPEM(pem) {
    const tag = "[A-Z0-9 ]+";
    const pattern = new RegExp(`-{5}BEGIN ${tag}-{5}([a-zA-Z0-9=+\\/\\n\\r]+)-{5}END ${tag}-{5}`, "g");
    const res = [];
    let matches = null;
    while (matches = pattern.exec(pem)) {
      const base64 = matches[1].replace(/[\r\n]/g, "");
      const binary = base64Decode(base64);
      const cert = new this(binary);
      res.push(cert);
    }
    return res;
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
      if (certName === hostName)
        return true;
    });
  }
  isValidAtMoment(moment = new Date()) {
    return moment >= this.validityPeriod.notBefore && moment <= this.validityPeriod.notAfter;
  }
  description() {
    return "subject: " + Object.entries(this.subject).map((x) => x.join("=")).join(", ") + (this.subjectAltNames ? "\nsubject alt names: " + this.subjectAltNames.join(", ") : "") + (this.subjectKeyIdentifier ? `
subject key id: ${hexFromU8(this.subjectKeyIdentifier, " ")}` : "") + "\nissuer: " + Object.entries(this.issuer).map((x) => x.join("=")).join(", ") + (this.authorityKeyIdentifier ? `
authority key id: ${hexFromU8(this.authorityKeyIdentifier, " ")}` : "") + "\nvalidity: " + this.validityPeriod.notBefore.toISOString() + " \u2013 " + this.validityPeriod.notAfter.toISOString() + ` (${this.isValidAtMoment() ? "currently valid" : "not valid"})` + (this.keyUsage ? `
key usage (${this.keyUsage.critical ? "critical" : "non-critical"}): ` + [...this.keyUsage.usages].join(", ") : "") + (this.extKeyUsage ? `
extended key usage: TLS server \u2014\xA0${this.extKeyUsage.serverTls}, TLS client \u2014\xA0${this.extKeyUsage.clientTls}` : "") + (this.basicConstraints ? `
basic constraints (${this.basicConstraints.critical ? "critical" : "non-critical"}): CA \u2014\xA0${this.basicConstraints.ca}, path length \u2014 ${this.basicConstraints.pathLength}` : "") + "\nsignature algorithm: " + descriptionForAlgorithm(algorithmWithOID(this.algorithm));
  }
  toJSON() {
    return {
      serialNumber: [...this.serialNumber],
      algorithm: this.algorithm,
      issuer: this.issuer,
      validityPeriod: {
        notBefore: this.validityPeriod.notBefore.toISOString(),
        notAfter: this.validityPeriod.notAfter.toISOString()
      },
      subject: this.subject,
      publicKey: {
        identifiers: this.publicKey.identifiers,
        data: [...this.publicKey.data],
        all: [...this.publicKey.all]
      },
      signature: [...this.signature],
      keyUsage: {
        critical: this.keyUsage?.critical,
        usages: [...this.keyUsage?.usages ?? []]
      },
      subjectAltNames: this.subjectAltNames,
      extKeyUsage: this.extKeyUsage,
      authorityKeyIdentifier: this.authorityKeyIdentifier && [...this.authorityKeyIdentifier],
      subjectKeyIdentifier: this.subjectKeyIdentifier && [...this.subjectKeyIdentifier],
      basicConstraints: this.basicConstraints,
      signedData: [...this.signedData]
    };
  }
};
var TrustedCert = class extends Cert {
};

// src/tls/ecdsa.ts
async function ecdsaVerify(sb, publicKey, signedData, namedCurve, hash) {
  sb.expectUint8(constructedUniversalTypeSequence, "sequence");
  const [endSigDer] = sb.expectASN1Length("sequence");
  sb.expectUint8(universalTypeInteger, "integer");
  const [endSigRBytes, sigRBytesRemaining] = sb.expectASN1Length("integer");
  let sigR = sb.readBytes(sigRBytesRemaining());
  sb.comment("signature: r");
  endSigRBytes();
  sb.expectUint8(universalTypeInteger, "integer");
  const [endSigSBytes, sigSBytesRemaining] = sb.expectASN1Length("integer");
  let sigS = sb.readBytes(sigSBytesRemaining());
  sb.comment("signature: s");
  endSigSBytes();
  endSigDer();
  const clampToLength = (x, clampLength) => x.length > clampLength ? x.subarray(x.length - clampLength) : x.length < clampLength ? concat(new Uint8Array(clampLength - x.length), x) : x;
  const intLength = namedCurve === "P-256" ? 32 : 48;
  const signature = concat(clampToLength(sigR, intLength), clampToLength(sigS, intLength));
  const signatureKey = await crypto.subtle.importKey("spki", publicKey, { name: "ECDSA", namedCurve }, false, ["verify"]);
  const certVerifyResult = await crypto.subtle.verify({ name: "ECDSA", hash }, signatureKey, signature, signedData);
  if (certVerifyResult !== true)
    throw new Error("ECDSA-SECP256R1-SHA256 certificate verify failed");
  log(`%c\u2713 ECDSA signature verified (curve ${namedCurve}, hash ${hash})`, "color: #8c8;");
}

// src/tls/verifyCerts.ts
async function verifyCerts(host, certs, rootCerts) {
  log("%c%s", `color: ${"#c88" /* header */}`, "certificates received from host");
  for (const cert of certs)
    log(...highlightColonList(cert.description()));
  log("Now we have all the certificates, which are summarised above. First, we do some basic checks on the end-user certificate \u2014\xA0i.e. the one this server is presenting as its own:");
  const userCert = certs[0];
  const matchingSubjectAltName = userCert.subjectAltNameMatchingHost(host);
  if (matchingSubjectAltName === void 0)
    throw new Error(`No matching subjectAltName for ${host}`);
  log(`%c\u2713 matched host to subjectAltName "${matchingSubjectAltName}"`, "color: #8c8;");
  const validNow = userCert.isValidAtMoment();
  if (!validNow)
    throw new Error("End-user certificate is not valid now");
  log(`%c\u2713 end-user certificate is valid now`, "color: #8c8;");
  if (!userCert.extKeyUsage?.serverTls)
    throw new Error("End-user certificate has no TLS server extKeyUsage");
  log(`%c\u2713 end-user certificate has TLS server extKeyUsage`, "color: #8c8;");
  log("Next, we verify the signature of each certificate using the public key of the next certificate in the chain. This carries on until we find a certificate we can verify using one of our own trusted root certificates (or until we reach the end of the chain and therefore fail):");
  let verifiedToTrustedRoot = false;
  log("%c%s", `color: ${"#c88" /* header */}`, "trusted root certificates");
  for (const cert of rootCerts)
    log(...highlightColonList(cert.description()));
  for (let i = 0, len = certs.length; i < len; i++) {
    const subjectCert = certs[i];
    const subjectAuthKeyId = subjectCert.authorityKeyIdentifier;
    if (subjectAuthKeyId === void 0)
      throw new Error("Certificates without an authorityKeyIdentifier are not supported");
    let signingCert = rootCerts.find((cert) => cert.subjectKeyIdentifier !== void 0 && equal(cert.subjectKeyIdentifier, subjectAuthKeyId));
    if (signingCert === void 0)
      signingCert = certs[i + 1];
    if (signingCert === void 0)
      throw new Error("Ran out of certificates before reaching trusted root");
    log("matched certificates on key id %s", hexFromU8(subjectAuthKeyId, " "));
    const signingCertIsTrustedRoot = signingCert instanceof TrustedCert;
    if (signingCert.isValidAtMoment() !== true)
      throw new Error("Signing certificate is not valid now");
    if (signingCert.keyUsage?.usages.has("digitalSignature") !== true)
      throw new Error("Signing certificate keyUsage does not include digital signatures");
    if (signingCert.basicConstraints?.ca !== true)
      throw new Error("Signing certificate basicConstraints do not indicate a CA certificate");
    const { pathLength } = signingCert.basicConstraints;
    if (pathLength !== void 0 && pathLength < i)
      throw new Error("Exceeded certificate path length");
    log(
      `verifying certificate CN "${subjectCert.subject.CN}" is signed by %c${signingCertIsTrustedRoot ? "trusted root" : "intermediate"}%c certificate CN "${signingCert.subject.CN}" ...`,
      `background: ${signingCertIsTrustedRoot ? "#ffc" : "#eee"}`,
      "background: inherit"
    );
    if (subjectCert.algorithm === "1.2.840.10045.4.3.2" || subjectCert.algorithm === "1.2.840.10045.4.3.3") {
      const hash = subjectCert.algorithm === "1.2.840.10045.4.3.2" ? "SHA-256" : "SHA-384";
      const signingKeyOIDs = signingCert.publicKey.identifiers;
      const namedCurve = signingKeyOIDs.includes("1.2.840.10045.3.1.7") ? "P-256" : signingKeyOIDs.includes("1.3.132.0.34") ? "P-384" : void 0;
      if (namedCurve === void 0)
        throw new Error("Unsupported signing key curve");
      const sb = new ASN1Bytes(subjectCert.signature);
      await ecdsaVerify(sb, signingCert.publicKey.all, subjectCert.signedData, namedCurve, hash);
    } else if (subjectCert.algorithm === "1.2.840.113549.1.1.11" || subjectCert.algorithm === "1.2.840.113549.1.1.12") {
      const hash = subjectCert.algorithm === "1.2.840.113549.1.1.11" ? "SHA-256" : "SHA-384";
      const signatureKey = await crypto.subtle.importKey("spki", signingCert.publicKey.all, { name: "RSASSA-PKCS1-v1_5", hash }, false, ["verify"]);
      const certVerifyResult = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, signatureKey, subjectCert.signature, subjectCert.signedData);
      if (certVerifyResult !== true)
        throw new Error("RSASSA_PKCS1-v1_5-SHA256 certificate verify failed");
      log(`%c\u2713 RSASAA-PKCS1-v1_5 signature verified`, "color: #8c8;");
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
async function readEncryptedHandshake(host, readHandshakeRecord, serverSecret, hellos, rootCerts) {
  const hs = new ASN1Bytes(await readHandshakeRecord());
  hs.expectUint8(8, "handshake record type: encrypted extensions");
  const [eeMessageEnd] = hs.expectLengthUint24();
  const [extEnd, extRemaining] = hs.expectLengthUint16("extensions");
  while (extRemaining() > 0) {
    const extType = hs.readUint16("extension type: ");
    if (extType === 0) {
      hs.comment("SNI");
      hs.expectUint16(0, "no extension data");
    } else if (extType === 10) {
      hs.comment("supported groups");
      const [endGroups, groupsRemaining] = hs.expectLengthUint16("groups data");
      hs.skip(groupsRemaining(), "ignored");
      endGroups();
    } else {
      throw new Error(`Unsupported server encrypted extension type 0x${hexFromU8([extType]).padStart(4, "0")}`);
    }
  }
  extEnd();
  eeMessageEnd();
  if (hs.remaining() === 0)
    hs.extend(await readHandshakeRecord());
  hs.expectUint8(11, "handshake message type: server certificate");
  const [endCertPayload] = hs.expectLengthUint24("certificate payload");
  hs.expectUint8(0, "0 bytes of request context follow");
  const [endCerts, certsRemaining] = hs.expectLengthUint24("certificates");
  const certs = [];
  while (certsRemaining() > 0) {
    const [endCert] = hs.expectLengthUint24("certificate");
    const cert = new Cert(hs);
    certs.push(cert);
    endCert();
    const [endCertExt, certExtRemaining] = hs.expectLengthUint16();
    const certExtData = hs.subarray(certExtRemaining());
    endCertExt();
  }
  endCerts();
  endCertPayload();
  if (certs.length === 0)
    throw new Error("No certificates supplied");
  const userCert = certs[0];
  const certVerifyHandshakeData = hs.data.subarray(0, hs.offset);
  const certVerifyData = concat(hellos, certVerifyHandshakeData);
  const certVerifyHashBuffer = await crypto.subtle.digest("SHA-256", certVerifyData);
  const certVerifyHash = new Uint8Array(certVerifyHashBuffer);
  const certVerifySignedData = concat(txtEnc3.encode(" ".repeat(64) + "TLS 1.3, server CertificateVerify"), [0], certVerifyHash);
  if (hs.remaining() === 0)
    hs.extend(await readHandshakeRecord());
  hs.expectUint8(15, "handshake message type: certificate verify");
  const [endCertVerifyPayload] = hs.expectLengthUint24("handshake message data");
  const sigType = hs.readUint16();
  log("verifying end-user certificate ...");
  if (sigType === 1027) {
    hs.comment("signature type ECDSA-SECP256R1-SHA256");
    const [endSignature] = hs.expectLengthUint16();
    await ecdsaVerify(hs, userCert.publicKey.all, certVerifySignedData, "P-256", "SHA-256");
    endSignature();
  } else if (sigType === 2052) {
    hs.comment("signature type RSA-PSS-RSAE-SHA256");
    const [endSignature, signatureRemaining] = hs.expectLengthUint16();
    const signature = hs.subarray(signatureRemaining());
    hs.comment("signature");
    endSignature();
    const signatureKey = await crypto.subtle.importKey("spki", userCert.publicKey.all, { name: "RSA-PSS", hash: "SHA-256" }, false, ["verify"]);
    const certVerifyResult = await crypto.subtle.verify({ name: "RSA-PSS", saltLength: 32 }, signatureKey, signature, certVerifySignedData);
    if (certVerifyResult !== true)
      throw new Error("RSA-PSS-RSAE-SHA256 certificate verify failed");
  } else {
    throw new Error(`Unsupported certificate verify signature type 0x${hexFromU8([sigType]).padStart(4, "0")}`);
  }
  log("%c\u2713 end-user certificate verified (server has private key)", "color: #8c8;");
  endCertVerifyPayload();
  const verifyHandshakeData = hs.data.subarray(0, hs.offset);
  const verifyData = concat(hellos, verifyHandshakeData);
  const finishedKey = await hkdfExpandLabel(serverSecret, "finished", new Uint8Array(0), 32, 256);
  const finishedHash = await crypto.subtle.digest("SHA-256", verifyData);
  const hmacKey = await crypto.subtle.importKey("raw", finishedKey, { name: "HMAC", hash: { name: `SHA-256` } }, false, ["sign"]);
  const correctVerifyHashBuffer = await crypto.subtle.sign("HMAC", hmacKey, finishedHash);
  const correctVerifyHash = new Uint8Array(correctVerifyHashBuffer);
  if (hs.remaining() === 0)
    hs.extend(await readHandshakeRecord());
  hs.expectUint8(20, "handshake message type: finished");
  const [endHsFinishedPayload, hsFinishedPayloadRemaining] = hs.expectLengthUint24("verify hash");
  const verifyHash = hs.readBytes(hsFinishedPayloadRemaining());
  hs.comment("verify hash");
  endHsFinishedPayload();
  if (hs.remaining() !== 0)
    throw new Error("Unexpected extra bytes in server handshake");
  const verifyHashVerified = equal(verifyHash, correctVerifyHash);
  if (verifyHashVerified !== true)
    throw new Error("Invalid server verify hash");
  log("Decrypted using the server handshake key, the server\u2019s handshake messages are then parsed as follows. This is a long section, since X.509 certificates are quite complex and there will be several of them:");
  log(...highlightBytes(hs.commentedString(true), "#88c" /* server */));
  const verifiedToTrustedRoot = await verifyCerts(host, certs, rootCerts);
  if (!verifiedToTrustedRoot)
    throw new Error("Validated certificate chain did not end in a trusted root");
  return hs.data;
}

// src/tls/startTls.ts
async function startTls(host, rootCerts, networkRead, networkWrite, useSNI = true, writePreData, expectPreData, commentPreData) {
  const ecdhKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const rawPublicKey = await crypto.subtle.exportKey("raw", ecdhKeys.publicKey);
  const sessionId = new Uint8Array(32);
  crypto.getRandomValues(sessionId);
  const clientHello = makeClientHello(host, rawPublicKey, sessionId, useSNI);
  log(...highlightBytes(clientHello.commentedString(), "#8cc" /* client */));
  const clientHelloData = clientHello.array();
  const initialData = writePreData ? concat(writePreData, clientHelloData) : clientHelloData;
  networkWrite(initialData);
  if (expectPreData) {
    const receivedPreData = await networkRead(expectPreData.length);
    if (!receivedPreData || !equal(receivedPreData, expectPreData))
      throw new Error("Pre data did not match expectation");
    log("The server responds:");
    log(...highlightBytes(hexFromU8(receivedPreData) + "  " + commentPreData, "#88c" /* server */));
  }
  const serverHelloRecord = await readTlsRecord(networkRead, 22 /* Handshake */);
  if (serverHelloRecord === void 0)
    throw new Error("Connection closed while awaiting server hello");
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverPublicKey = parseServerHello(serverHello, sessionId);
  log(...highlightBytes(serverHelloRecord.header.commentedString() + serverHello.commentedString(), "#88c" /* server */));
  const changeCipherRecord = await readTlsRecord(networkRead, 20 /* ChangeCipherSpec */);
  if (changeCipherRecord === void 0)
    throw new Error("Connection closed awaiting server cipher change");
  const ccipher = new Bytes(changeCipherRecord.content);
  const [endCipherPayload] = ccipher.expectLength(1);
  ccipher.expectUint8(1, "dummy ChangeCipherSpec payload (middlebox compatibility)");
  endCipherPayload();
  log("For the benefit of badly-written middleboxes that are following along expecting TLS 1.2, the server sends a meaningless cipher change record:");
  log(...highlightBytes(changeCipherRecord.header.commentedString() + ccipher.commentedString(), "#88c" /* server */));
  log("Both sides of the exchange now have everything they need to calculate the keys and IVs that will protect the rest of the handshake:");
  log("%c%s", `color: ${"#c88" /* header */}`, "handshake key computations");
  const clientHelloContent = clientHelloData.subarray(5);
  const serverHelloContent = serverHelloRecord.content;
  const hellos = concat(clientHelloContent, serverHelloContent);
  const handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16);
  const serverHandshakeKey = await crypto.subtle.importKey("raw", handshakeKeys.serverHandshakeKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const handshakeDecrypter = new Crypter("decrypt", serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await crypto.subtle.importKey("raw", handshakeKeys.clientHandshakeKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const handshakeEncrypter = new Crypter("encrypt", clientHandshakeKey, handshakeKeys.clientHandshakeIV);
  log("The server sends one or more encrypted records containing the rest of its handshake messages. These include the \u2018certificate verify\u2019 message, which we check on the spot, and the full certificate chain, which we verify a bit later on:");
  const readHandshakeRecord = async () => {
    const tlsRecord = await readEncryptedTlsRecord(networkRead, handshakeDecrypter, 22 /* Handshake */);
    if (tlsRecord === void 0)
      throw new Error("Premature end of encrypted server handshake");
    return tlsRecord;
  };
  const serverHandshake = await readEncryptedHandshake(host, readHandshakeRecord, handshakeKeys.serverSecret, hellos, rootCerts);
  log("For the benefit of badly-written middleboxes that are following along expecting TLS 1.2, it\u2019s the client\u2019s turn to send a meaningless cipher change record:");
  const clientCipherChange = new Bytes(6);
  clientCipherChange.writeUint8(20, "record type: ChangeCipherSpec");
  clientCipherChange.writeUint16(771, "TLS version 1.2 (middlebox compatibility)");
  const endClientCipherChangePayload = clientCipherChange.writeLengthUint16();
  clientCipherChange.writeUint8(1, "dummy ChangeCipherSpec payload (middlebox compatibility)");
  endClientCipherChangePayload();
  log(...highlightBytes(clientCipherChange.commentedString(), "#8cc" /* client */));
  const clientCipherChangeData = clientCipherChange.array();
  log("Next, we send a \u2019handshake finished\u2019 message, which includes an HMAC of (nearly) the whole handshake to date. This is how it looks before encryption:");
  const wholeHandshake = concat(hellos, serverHandshake);
  const wholeHandshakeHashBuffer = await crypto.subtle.digest("SHA-256", wholeHandshake);
  const wholeHandshakeHash = new Uint8Array(wholeHandshakeHashBuffer);
  const finishedKey = await hkdfExpandLabel(handshakeKeys.clientSecret, "finished", new Uint8Array(0), 32, 256);
  const verifyHmacKey = await crypto.subtle.importKey("raw", finishedKey, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
  const verifyDataBuffer = await crypto.subtle.sign("HMAC", verifyHmacKey, wholeHandshakeHash);
  const verifyData = new Uint8Array(verifyDataBuffer);
  const clientFinishedRecord = new Bytes(36);
  clientFinishedRecord.writeUint8(20, "handshake message type: finished");
  const clientFinishedRecordEnd = clientFinishedRecord.writeLengthUint24("handshake finished data");
  clientFinishedRecord.writeBytes(verifyData);
  clientFinishedRecord.comment("verify data");
  clientFinishedRecordEnd();
  log(...highlightBytes(clientFinishedRecord.commentedString(), "#8cc" /* client */));
  log("And here it is encrypted with the client\u2019s handshake key and ready to go:");
  const encryptedClientFinished = await makeEncryptedTlsRecords(clientFinishedRecord.array(), handshakeEncrypter, 22 /* Handshake */);
  log("Both parties now have what they need to calculate the keys and IVs that will protect the application data:");
  log("%c%s", `color: ${"#c88" /* header */}`, "application key computations");
  const applicationKeys = await getApplicationKeys(handshakeKeys.handshakeSecret, wholeHandshakeHash, 256, 16);
  const clientApplicationKey = await crypto.subtle.importKey("raw", applicationKeys.clientApplicationKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const applicationEncrypter = new Crypter("encrypt", clientApplicationKey, applicationKeys.clientApplicationIV);
  const serverApplicationKey = await crypto.subtle.importKey("raw", applicationKeys.serverApplicationKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const applicationDecrypter = new Crypter("decrypt", serverApplicationKey, applicationKeys.serverApplicationIV);
  let wroteFinishedRecords = false;
  log("The TLS connection is established, and server and client can start exchanging encrypted application data.");
  const read = () => {
    if (!wroteFinishedRecords) {
      const finishedRecords = concat(clientCipherChangeData, ...encryptedClientFinished);
      networkWrite(finishedRecords);
      wroteFinishedRecords = true;
    }
    return readEncryptedTlsRecord(networkRead, applicationDecrypter);
  };
  const write = async (data) => {
    const encryptedRecords = await makeEncryptedTlsRecords(data, applicationEncrypter, 23 /* Application */);
    const allRecords = wroteFinishedRecords ? concat(...encryptedRecords) : concat(clientCipherChangeData, ...encryptedClientFinished, ...encryptedRecords);
    networkWrite(allRecords);
    wroteFinishedRecords = true;
  };
  return [read, write];
}

// src/roots/isrg-root-x1.pem
var isrg_root_x1_default = "-----BEGIN CERTIFICATE-----\nMIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\nTzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\ncmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\nWhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\nZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\nMTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\nh77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\nA5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\nT8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\nB5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\nB5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\nKBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\nOlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\njh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\nqHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\nrU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\nHRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\nhkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\nubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\nNFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\nORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\nTkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC\njNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc\noyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq\n4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA\nmRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d\nemyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=\n-----END CERTIFICATE-----\n";

// src/roots/isrg-root-x2.pem
var isrg_root_x2_default = "-----BEGIN CERTIFICATE-----\nMIICGzCCAaGgAwIBAgIQQdKd0XLq7qeAwSxs6S+HUjAKBggqhkjOPQQDAzBPMQsw\nCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2gg\nR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMjAeFw0yMDA5MDQwMDAwMDBaFw00\nMDA5MTcxNjAwMDBaME8xCzAJBgNVBAYTAlVTMSkwJwYDVQQKEyBJbnRlcm5ldCBT\nZWN1cml0eSBSZXNlYXJjaCBHcm91cDEVMBMGA1UEAxMMSVNSRyBSb290IFgyMHYw\nEAYHKoZIzj0CAQYFK4EEACIDYgAEzZvVn4CDCuwJSvMWSj5cz3es3mcFDR0HttwW\n+1qLFNvicWDEukWVEYmO6gbf9yoWHKS5xcUy4APgHoIYOIvXRdgKam7mAHf7AlF9\nItgKbppbd9/w+kHsOdx1ymgHDB/qo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T\nAQH/BAUwAwEB/zAdBgNVHQ4EFgQUfEKWrt5LSDv6kviejM9ti6lyN5UwCgYIKoZI\nzj0EAwMDaAAwZQIwe3lORlCEwkSHRhtFcP9Ymd70/aTSVaYgLXTWNLxBo1BfASdW\ntL4ndQavEi51mI38AjEAi/V3bNTIZargCyzuFJ0nN6T5U6VR5CmD1/iQMVtCnwr1\n/q4AaOeMSQ+2b1tbFfLn\n-----END CERTIFICATE-----\n";

// src/https.ts
var txtDec2 = new TextDecoder();
async function https(urlStr, method = "GET") {
  const t0 = Date.now();
  const url = new URL(urlStr);
  if (url.protocol !== "https:")
    throw new Error("Wrong protocol");
  const host = url.hostname;
  const port = url.port || 443;
  const reqPath = url.pathname + url.search;
  const ws = await new Promise((resolve) => {
    const ws2 = new WebSocket(`ws://localhost:9876/v1?address=${host}:${port}`);
    ws2.binaryType = "arraybuffer";
    ws2.addEventListener("open", () => resolve(ws2));
    ws2.addEventListener("error", (err) => {
      console.log("ws error:", err);
    });
    ws2.addEventListener("close", () => {
      log("connection closed");
    });
  });
  const reader = new ReadQueue(ws);
  const rootCert = TrustedCert.fromPEM(isrg_root_x1_default + isrg_root_x2_default);
  const [read, write] = await startTls(host, rootCert, reader.read.bind(reader), ws.send.bind(ws));
  const request = new Bytes(1024);
  request.writeUTF8String(`${method} ${reqPath} HTTP/1.0\r
Host:${host}\r
\r
`);
  log(...highlightBytes(request.commentedString(), "#8cc" /* client */));
  write(request.array());
  let responseData;
  let response = "";
  do {
    responseData = await read();
    if (responseData) {
      const responseText = txtDec2.decode(responseData);
      response += responseText;
      log(responseText);
    }
  } while (responseData);
  return response;
}

// src/postgres.ts
async function postgres(urlStr) {
  const t0 = Date.now();
  const url = parse(urlStr);
  const host = url.hostname;
  const port = url.port || 5432;
  const user = url.username;
  const password = `project=${host.match(/^[^.]+/)[0]};${url.password}`;
  const db = url.pathname.slice(1);
  const ws = await new Promise((resolve) => {
    const ws2 = new WebSocket(`ws://ws.neon.build/v1?address=${host}:${port}`);
    ws2.binaryType = "arraybuffer";
    ws2.addEventListener("open", () => resolve(ws2));
    ws2.addEventListener("error", (err) => {
      console.log("ws error:", err);
    });
    ws2.addEventListener("close", () => {
      log("connection closed");
    });
  });
  const reader = new ReadQueue(ws);
  const networkRead = reader.read.bind(reader);
  const networkWrite = ws.send.bind(ws);
  const sslRequest = new Bytes(8);
  const endSslRequest = sslRequest.writeLengthUint32Incl("SSL request");
  sslRequest.writeUint32(80877103, "SSL request code");
  endSslRequest();
  log("First of all, we send a fixed 8-byte sequence that asks the Postgres server if SSL/TLS is available:");
  log(...highlightBytes(sslRequest.commentedString(), "#8cc" /* client */));
  const writePreData = sslRequest.array();
  log("We don\u2019t need to wait for the reply: we run this server, so we know it\u2019s going to answer yes. We thus save time by ploughing straight on with the TLS handshake, which begins with a \u2018client hello\u2019:");
  const sslResponse = new Bytes(1);
  sslResponse.writeUTF8String("S");
  const expectPreData = sslResponse.array();
  const rootCert = TrustedCert.fromPEM(isrg_root_x1_default);
  const [read, write] = await startTls(host, rootCert, networkRead, networkWrite, false, writePreData, expectPreData, '"S" = SSL connection supported');
  const msg = new Bytes(1024);
  const endStartupMessage = msg.writeLengthUint32Incl("startup message");
  msg.writeUint32(196608, "protocol version");
  msg.writeUTF8StringNullTerminated("user");
  msg.writeUTF8StringNullTerminated(user);
  msg.writeUTF8StringNullTerminated("database");
  msg.writeUTF8StringNullTerminated(db);
  msg.writeUint8(0, "end of message");
  endStartupMessage();
  msg.writeUTF8String("p");
  msg.comment("= password");
  const endPasswordMessage = msg.writeLengthUint32Incl("password message");
  msg.writeUTF8StringNullTerminated(password);
  endPasswordMessage();
  msg.writeUTF8String("Q");
  msg.comment("= simple query");
  const endQuery = msg.writeLengthUint32Incl("query");
  msg.writeUTF8StringNullTerminated("SELECT now()");
  endQuery();
  log("We cheat a bit again here. By assuming we know how the server will respond, we can save several network round-trips and bundle up a Postgres startup message, a cleartext password message, and a simple query. Here\u2019s the plaintext:");
  log(...highlightBytes(msg.commentedString(), "#8cc" /* client */));
  log("And the ciphertext looks like this:");
  await write(msg.array());
  log("The server now responds to each message in turn. First it responds to the startup message with a request for our password. Encrypted, as received:");
  const preAuthResponse = await read();
  const preAuthBytes = new Bytes(preAuthResponse);
  preAuthBytes.expectUint8("R".charCodeAt(0), '"R" = authentication request');
  const [endAuthReq] = preAuthBytes.expectLengthUint32Incl("request");
  preAuthBytes.expectUint32(3, "request cleartext password auth");
  endAuthReq();
  log("Decrypted and parsed:");
  log(...highlightBytes(preAuthBytes.commentedString(true), "#88c" /* server */));
  log("Next, it responds to the password we sent, and provides some other useful data. Encrypted, that\u2019s:");
  const postAuthResponse = await read();
  const postAuthBytes = new Bytes(postAuthResponse);
  postAuthBytes.expectUint8("R".charCodeAt(0), '"R" = authentication request');
  const [endAuthOK] = postAuthBytes.expectLengthUint32Incl("result");
  postAuthBytes.expectUint32(0, "authentication successful");
  endAuthOK();
  while (postAuthBytes.remaining() > 0) {
    const msgType = postAuthBytes.readUTF8String(1);
    if (msgType === "S") {
      postAuthBytes.comment("= parameter status");
      const [endParams, paramsRemaining] = postAuthBytes.expectLengthUint32Incl("run-time parameters");
      while (paramsRemaining() > 0) {
        const k = postAuthBytes.readUTF8StringNullTerminated();
        const v = postAuthBytes.readUTF8StringNullTerminated();
      }
      endParams();
    } else if (msgType === "K") {
      postAuthBytes.comment("= back-end key data");
      const [endKeyData] = postAuthBytes.expectLengthUint32Incl();
      postAuthBytes.readUint32("backend process ID");
      postAuthBytes.readUint32("backend secret key");
      endKeyData();
    } else if (msgType === "Z") {
      postAuthBytes.comment("= ready for query");
      const [endStatus] = postAuthBytes.expectLengthUint32Incl("status");
      postAuthBytes.expectUint8("I".charCodeAt(0), '"I" = status: idle');
      endStatus();
    }
  }
  log("Decrypted and parsed:");
  log(...highlightBytes(postAuthBytes.commentedString(true), "#88c" /* server */));
  log("Lastly, it returns our query result. Encrypted:");
  const queryResult = await read();
  const queryResultBytes = new Bytes(queryResult);
  queryResultBytes.expectUint8("T".charCodeAt(0), '"T" = row description');
  const [endRowDescription] = queryResultBytes.expectLengthUint32Incl();
  const fieldsPerRow = queryResultBytes.readUint16("fields per row");
  for (let i = 0; i < fieldsPerRow; i++) {
    const columnName = queryResultBytes.readUTF8StringNullTerminated();
    queryResultBytes.comment("= column name", queryResultBytes.offset - 1);
    const tableOID = queryResultBytes.readUint32("table OID");
    const colAttrNum = queryResultBytes.readUint16("column attribute number");
    const dataTypeOID = queryResultBytes.readUint32("data type OID");
    const dataTypeSize = queryResultBytes.readUint16("data type size");
    const dataTypeModifier = queryResultBytes.readUint32("data type modifier");
    const formatCode = queryResultBytes.readUint16("format code");
  }
  endRowDescription();
  let lastColumnData;
  while (queryResultBytes.remaining() > 0) {
    const msgType = queryResultBytes.readUTF8String(1);
    if (msgType === "D") {
      queryResultBytes.comment("= data row");
      const [endDataRow] = queryResultBytes.expectLengthUint32Incl();
      const columnsToFollow = queryResultBytes.readUint16("columns to follow");
      for (let i = 0; i < columnsToFollow; i++) {
        const [endColumn, columnRemaining] = queryResultBytes.expectLengthUint32();
        lastColumnData = queryResultBytes.readUTF8String(columnRemaining());
        queryResultBytes.comment("= column value");
        endColumn();
      }
      endDataRow();
    } else if (msgType === "C") {
      queryResultBytes.comment("= close command");
      const [endClose] = queryResultBytes.expectLengthUint32Incl();
      queryResultBytes.readUTF8StringNullTerminated();
      queryResultBytes.comment("= command tag", queryResultBytes.offset - 1);
      endClose();
    } else if (msgType === "Z") {
      queryResultBytes.comment("= ready for query");
      const [endReady] = queryResultBytes.expectLengthUint32Incl();
      queryResultBytes.expectUint8("I".charCodeAt(0), '"I" = status: idle');
      endReady();
    } else {
      throw new Error(`Unexpected message type: ${msgType}`);
    }
  }
  log("Decrypted and parsed:");
  log(...highlightBytes(queryResultBytes.commentedString(true), "#88c" /* server */));
  log("We pick out our result \u2014\xA0the current time on our server:");
  log("%c%s", "font-size: 2em", lastColumnData);
  const endBytes = new Bytes(5);
  endBytes.writeUTF8String("X");
  endBytes.comment("= terminate");
  const endTerminate = endBytes.writeLengthUint32Incl();
  endTerminate();
  log("Last of all, we send a termination command. Before encryption, that\u2019s:");
  log(...highlightBytes(endBytes.commentedString(true), "#8cc" /* client */));
  log("And as sent on the wire:");
  await write(endBytes.array());
}
function parse(url, parseQueryString = false) {
  const { protocol } = new URL(url);
  const httpUrl = "http:" + url.substring(protocol.length);
  let { username, password, hostname, port, pathname, search, searchParams, hash } = new URL(httpUrl);
  password = decodeURIComponent(password);
  const auth = username + ":" + password;
  const query = parseQueryString ? Object.fromEntries(searchParams.entries()) : search;
  return { href: url, protocol, auth, username, password, hostname, port, pathname, search, query, hash };
}
export {
  https,
  postgres
};
