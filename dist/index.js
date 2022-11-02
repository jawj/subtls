// src/util/highlightCommented.ts
function highlightCommented_default(s, colour) {
  const css = [];
  s = s.replace(/  .+$/gm, (m) => {
    css.push(`color: ${colour}`, "color: inherit");
    return `  %c${m}%c`;
  });
  return [s, ...css];
}

// src/util/bytes.ts
var Bytes = class {
  offset;
  dataView;
  uint8Array;
  comments;
  textEncoder;
  constructor(arrayOrMaxBytes) {
    this.offset = 0;
    this.uint8Array = typeof arrayOrMaxBytes === "number" ? new Uint8Array(arrayOrMaxBytes) : arrayOrMaxBytes;
    this.dataView = new DataView(this.uint8Array.buffer, this.uint8Array.byteOffset, this.uint8Array.byteLength);
    this.comments = {};
    this.textEncoder = new TextEncoder();
  }
  remainingBytes() {
    return this.uint8Array.length - this.offset;
  }
  subarray(length) {
    return this.uint8Array.subarray(this.offset, this.offset += length);
  }
  slice(length) {
    return this.uint8Array.slice(this.offset, this.offset += length);
  }
  skip(length, comment) {
    this.offset += length;
    if (comment !== void 0)
      this.comment(comment);
    return this;
  }
  comment(s, offset = this.offset) {
    this.comments[offset] = s;
    return this;
  }
  readUint8(comment) {
    const result = this.dataView.getUint8(this.offset);
    this.offset += 1;
    if (comment !== void 0)
      this.comment(comment);
    return result;
  }
  readUint16(comment) {
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    if (comment !== void 0)
      this.comment(comment);
    return result;
  }
  readUint24(comment) {
    const msb = this.readUint8();
    const lsbs = this.readUint16(comment);
    return (msb << 16) + lsbs;
  }
  expectUint8(expectedValue, comment) {
    const actualValue = this.readUint8();
    if (comment !== void 0)
      this.comment(comment);
    if (actualValue !== expectedValue)
      throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  expectUint16(expectedValue, comment) {
    const actualValue = this.readUint16();
    if (comment !== void 0)
      this.comment(comment);
    if (actualValue !== expectedValue)
      throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  writeBytes(bytes) {
    this.uint8Array.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }
  writeUTF8String(s) {
    const bytes = this.textEncoder.encode(s);
    this.writeBytes(bytes);
    this.comment('"' + s + '"');
    return this;
  }
  writeUint8(...args) {
    for (const arg of args) {
      this.dataView.setUint8(this.offset, arg);
      this.offset += 1;
    }
    return this;
  }
  writeUint16(...args) {
    for (const arg of args) {
      this.dataView.setUint16(this.offset, arg);
      this.offset += 2;
    }
    return this;
  }
  _lengthGeneric(lengthBytes, comment) {
    const startOffset = this.offset;
    this.offset += lengthBytes;
    const endOffset = this.offset;
    return () => {
      const length = this.offset - endOffset;
      if (lengthBytes === 1)
        this.dataView.setUint8(startOffset, length);
      else if (lengthBytes === 2)
        this.dataView.setUint16(startOffset, length);
      else if (lengthBytes === 3) {
        this.dataView.setUint8(startOffset, (length & 16711680) >> 16);
        this.dataView.setUint16(startOffset + 1, length & 65535);
      } else
        throw new Error(`Invalid length for length field: ${lengthBytes}`);
      this.comment(`${length} bytes${comment ? ` of ${comment}` : ""} follow`, endOffset);
    };
  }
  lengthUint8(comment) {
    return this._lengthGeneric(1, comment);
  }
  lengthUint16(comment) {
    return this._lengthGeneric(2, comment);
  }
  lengthUint24(comment) {
    return this._lengthGeneric(3, comment);
  }
  array() {
    return this.uint8Array.subarray(0, this.offset);
  }
  commentedString(s = "") {
    for (let i = 0; i < this.offset; i++) {
      s += this.uint8Array[i].toString(16).padStart(2, "0") + " ";
      const comment = this.comments[i + 1];
      if (comment !== void 0)
        s += ` ${comment}
`;
    }
    return s;
  }
};

// src/clientHello.ts
function clientHello(host, publicKey) {
  const hello = new Bytes(1024);
  hello.writeUint8(22);
  hello.comment("record type: handshake");
  hello.writeUint16(769);
  hello.comment("TLS protocol version 1.0");
  const endRecordHeader = hello.lengthUint16();
  hello.writeUint8(1);
  hello.comment("handshake type: client hello");
  const endHandshakeHeader = hello.lengthUint24();
  hello.writeUint16(771);
  hello.comment("TLS version 1.2 (middlebox compatibility)");
  crypto.getRandomValues(hello.subarray(32));
  hello.comment("client random");
  const endSessionId = hello.lengthUint8("session ID");
  crypto.getRandomValues(hello.subarray(32));
  hello.comment("session ID (middlebox compatibility)");
  endSessionId();
  const endCiphers = hello.lengthUint16("ciphers");
  hello.writeUint16(4865);
  hello.comment("cipher: TLS_AES_128_GCM_SHA256");
  endCiphers();
  const endCompressionMethods = hello.lengthUint8("compression methods");
  hello.writeUint8(0);
  hello.comment("compression method: none");
  endCompressionMethods();
  const endExtensions = hello.lengthUint16("extensions");
  hello.writeUint16(0);
  hello.comment("extension type: SNI");
  const endSNIExt = hello.lengthUint16("SNI data");
  const endSNI = hello.lengthUint16("SNI records");
  hello.writeUint8(0);
  hello.comment("list entry type: DNS hostname");
  const endHostname = hello.lengthUint16("hostname");
  hello.writeUTF8String(host);
  endHostname();
  endSNI();
  endSNIExt();
  hello.writeUint16(11);
  hello.comment("extension type: EC point formats");
  const endFormatTypesExt = hello.lengthUint16("formats data");
  const endFormatTypes = hello.lengthUint8("formats");
  hello.writeUint8(0);
  hello.comment("format: uncompressed");
  endFormatTypes();
  endFormatTypesExt();
  hello.writeUint16(10);
  hello.comment("extension type: supported groups (curves)");
  const endGroupsExt = hello.lengthUint16("groups data");
  const endGroups = hello.lengthUint16("groups");
  hello.writeUint16(23);
  hello.comment("curve secp256r1 (NIST P-256)");
  endGroups();
  endGroupsExt();
  hello.writeUint16(13);
  hello.comment("extension type: signature algorithms");
  const endSigsExt = hello.lengthUint16("signature algorithms data");
  const endSigs = hello.lengthUint16("signature algorithms");
  hello.writeUint16(1027);
  hello.comment("ECDSA-SECP256r1-SHA256");
  endSigs();
  endSigsExt();
  hello.writeUint16(43);
  hello.comment("extension type: supported TLS versions");
  const endVersionsExt = hello.lengthUint16("TLS versions data");
  const endVersions = hello.lengthUint8("TLS versions");
  hello.writeUint16(772);
  hello.comment("TLS version 1.3");
  endVersions();
  endVersionsExt();
  hello.writeUint16(51);
  hello.comment("extension type: key share");
  const endKeyShareExt = hello.lengthUint16("key share data");
  const endKeyShares = hello.lengthUint16("key shares");
  hello.writeUint16(23);
  hello.comment("secp256r1 (NIST P-256) key share");
  const endKeyShare = hello.lengthUint16("key share");
  hello.writeBytes(new Uint8Array(publicKey));
  hello.comment("key");
  endKeyShare();
  endKeyShares();
  endKeyShareExt();
  endExtensions();
  endHandshakeHeader();
  endRecordHeader();
  return hello;
}

// src/util/readqueue.ts
var ReadQueue = class {
  queue;
  outstandingRequest;
  constructor(ws) {
    this.queue = [];
    ws.addEventListener("message", (msg) => this.enqueue(new Uint8Array(msg.data)));
  }
  enqueue(data) {
    this.queue.push(data);
    this.dequeue();
  }
  dequeue() {
    if (this.outstandingRequest === void 0)
      return;
    const { resolve, bytes } = this.outstandingRequest;
    const bytesInQueue = this.bytesInQueue();
    if (bytesInQueue < bytes)
      return;
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

// src/util/tlsrecord.ts
var RecordTypeNames = {
  20: "0x14 ChangeCipherSpec",
  21: `0x15 Alert`,
  22: `0x16 Handshake`,
  23: `0x17 Application`,
  24: `0x18 Heartbeat`
};
var maxRecordLength = 1 << 14;
async function readTlsRecord(reader, expectedType) {
  const headerData = await reader.read(5);
  const header = new Bytes(headerData);
  const type = header.readUint8("record type");
  if (type < 20 || type > 24)
    throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  if (expectedType !== void 0 && type !== expectedType)
    throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, "0")} (expected ${expectedType.toString(16).padStart(2, "0")})`);
  const version = header.readUint16("TLS version");
  if ([769, 770, 771].indexOf(version) < 0)
    throw new Error(`Unsupported TLS record version 0x${version.toString(16).padStart(4, "0")}`);
  const length = header.readUint16("record length");
  if (length > maxRecordLength)
    throw new Error(`Record too long: ${length} bytes`);
  const content = await reader.read(length);
  return { header, type, version, length, content };
}

// src/index.ts
var clientColour = "#aca";
var serverColour = "#aac";
async function startTls(host, port) {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const publicKey = await crypto.subtle.exportKey("raw", keys.publicKey);
  const ws = await new Promise((resolve) => {
    const ws2 = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws2.binaryType = "arraybuffer";
    ws2.addEventListener("open", () => resolve(ws2));
  });
  const reader = new ReadQueue(ws);
  const hello = clientHello(host, publicKey);
  console.log(...highlightCommented_default(hello.commentedString(), clientColour));
  ws.send(hello.array());
  const shellodata = await readTlsRecord(reader, 22 /* Handshake */);
  const shello = new Bytes(shellodata.content);
  shello.expectUint8(2, "handshake type: server hello");
  const helloLength = shello.readUint24("server hello length");
  shello.expectUint16(771, "TLS version 1.2 (middlebox compatibility)");
  const serverRandom = shello.slice(32);
  shello.comment("server random");
  shello.expectUint8(32, "session ID length");
  shello.skip(32, "session ID (should match client hello)");
  shello.expectUint16(4865, "cipher (matches client hello)");
  shello.expectUint8(0, "no compression");
  const extensionsLength = shello.readUint16("extensions length");
  while (shello.remainingBytes() > 0) {
    const extensionType = shello.readUint16("extension type");
    const extensionLength = shello.readUint16("extension length");
    if (extensionType === 43) {
      if (extensionLength !== 2)
        throw new Error(`Unexpected extension length: ${extensionLength} (expected 2)`);
      shello.expectUint16(772, "TLS version 1.3");
    } else if (extensionType === 51) {
      shello.expectUint16(23, "secp256r1 (NIST P-256) key share");
      shello.expectUint16(65);
      const serverPublicKey = shello.slice(65);
      shello.comment("key");
    } else {
      throw new Error(`Unexpected extension 0x${extensionType.toString(16).padStart(4, "0")}, length ${extensionLength}`);
    }
  }
  if (shello.remainingBytes() !== 0)
    throw new Error(`Unexpected additional data at end of server hello`);
  console.log(...highlightCommented_default(shellodata.header.commentedString() + shello.commentedString(), serverColour));
  const changeCipherRecord = await readTlsRecord(reader, 20 /* ChangeCipherSpec */);
  const ccipher = new Bytes(changeCipherRecord.content);
  ccipher.expectUint8(1, "dummy ChangeCipherSpec payload (middlebox compatibility)");
  if (ccipher.remainingBytes() !== 0)
    throw new Error(`Unexpected additional data at end of ChangeCipherSpec`);
  console.log(...highlightCommented_default(changeCipherRecord.header.commentedString() + ccipher.commentedString(), serverColour));
  const record = await readTlsRecord(reader, 23 /* Application */);
  console.log(RecordTypeNames[record.type], record);
}
startTls("cloudflare.com", 443);
