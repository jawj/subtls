// src/util/highlightCommented.ts
function highlightCommented_default(s, colour) {
  const css = [];
  s = s.replace(/  .+$/gm, (m) => {
    css.push(`color: ${colour}`, "color: inherit");
    return `%c${m}%c`;
  });
  return [s, ...css];
}

// src/util/bytes.ts
var txtEnc = new TextEncoder();
var Bytes = class {
  offset;
  dataView;
  uint8Array;
  comments;
  constructor(arrayOrMaxBytes) {
    this.offset = 0;
    this.uint8Array = typeof arrayOrMaxBytes === "number" ? new Uint8Array(arrayOrMaxBytes) : arrayOrMaxBytes;
    this.dataView = new DataView(this.uint8Array.buffer, this.uint8Array.byteOffset, this.uint8Array.byteLength);
    this.comments = {};
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
    const bytes = txtEnc.encode(s);
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
function makeClientHello(host, publicKey) {
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
  20: "ChangeCipherSpec",
  21: "Alert",
  22: "Handshake",
  23: "Application",
  24: "Heartbeat"
};
var maxRecordLength = 1 << 14;
async function readTlsRecord(reader, expectedType) {
  const headerData = await reader.read(5);
  const header = new Bytes(headerData);
  const type = header.readUint8();
  if (type < 20 || type > 24)
    throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  if (expectedType !== void 0 && type !== expectedType)
    throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, "0")} (expected ${expectedType.toString(16).padStart(2, "0")})`);
  header.comment(`record type: ${RecordTypeNames[type]}`);
  const version = header.readUint16("TLS version");
  if ([769, 770, 771].indexOf(version) < 0)
    throw new Error(`Unsupported TLS record version 0x${version.toString(16).padStart(4, "0")}`);
  const length = header.readUint16("record length");
  if (length > maxRecordLength)
    throw new Error(`Record too long: ${length} bytes`);
  const content = await reader.read(length);
  return { headerData, header, type, version, length, content };
}

// src/parseServerHello.ts
function parseServerHello(hello) {
  let serverPublicKey;
  let tlsVersionSpecified;
  hello.expectUint8(2, "handshake type: server hello");
  const helloLength = hello.readUint24("server hello length");
  hello.expectUint16(771, "TLS version 1.2 (middlebox compatibility)");
  hello.skip(32, "server random");
  hello.expectUint8(32, "session ID length");
  hello.skip(32, "session ID (should match client hello)");
  hello.expectUint16(4865, "cipher (matches client hello)");
  hello.expectUint8(0, "no compression");
  const extensionsLength = hello.readUint16("extensions length");
  while (hello.remainingBytes() > 0) {
    const extensionType = hello.readUint16("extension type");
    const extensionLength = hello.readUint16("extension length");
    if (extensionType === 43) {
      if (extensionLength !== 2)
        throw new Error(`Unexpected extension length: ${extensionLength} (expected 2)`);
      hello.expectUint16(772, "TLS version 1.3");
      tlsVersionSpecified = true;
    } else if (extensionType === 51) {
      hello.expectUint16(23, "secp256r1 (NIST P-256) key share");
      hello.expectUint16(65);
      serverPublicKey = hello.slice(65);
      hello.comment("key");
    } else {
      throw new Error(`Unexpected extension 0x${extensionType.toString(16).padStart(4, "0")}, length ${extensionLength}`);
    }
  }
  if (hello.remainingBytes() !== 0)
    throw new Error(`Unexpected additional data at end of server hello`);
  if (tlsVersionSpecified !== true || serverPublicKey === void 0)
    throw new Error(`Incomplete server hello`);
  return serverPublicKey;
}

// src/util/hex.ts
function hexFromU8(u8) {
  return [...u8].map((n) => n.toString(16).padStart(2, "0")).join("");
}

// src/keyscalc.ts
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
  const infoLength = info.length;
  let tPrev = new Uint8Array(0);
  for (let i = 0; i < n; i++) {
    const tPrevLength = tPrev.length;
    const hmacData = new Uint8Array(tPrevLength + infoLength + 1);
    hmacData.set(tPrev);
    hmacData.set(info, tPrevLength);
    hmacData[tPrevLength + infoLength] = i + 1;
    const tiBuffer = await crypto.subtle.sign("HMAC", hmacKey, hmacData);
    const ti = new Uint8Array(tiBuffer);
    okm.set(ti, hashBytes * i);
    tPrev = ti;
  }
  return okm.subarray(0, length);
}
var tls13_Bytes = txtEnc2.encode("tls13 ");
async function hkdfExpandLabel(key, label, context, length, hashBits) {
  const labelLength = label.length;
  const contextLength = context.length;
  const hkdfLabel = new Uint8Array(2 + 1 + 6 + labelLength + 1 + contextLength);
  hkdfLabel[0] = (length & 65280) >> 8;
  hkdfLabel[1] = length & 255;
  hkdfLabel[2] = labelLength + 6;
  hkdfLabel.set(tls13_Bytes, 2 + 1);
  hkdfLabel.set(label, 2 + 1 + 6);
  hkdfLabel[2 + 1 + 6 + labelLength] = contextLength;
  hkdfLabel.set(context, 2 + 1 + 6 + labelLength + 1);
  return hkdfExpand(key, hkdfLabel, length, hashBits);
}
async function getHandshakeKeys(sharedSecret, hellosHash, hashBits, keyLength) {
  const hashBytes = hashBits >> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashBits);
  console.log("early secret", hexFromU8(new Uint8Array(earlySecret)));
  const emptyHashBuffer = await crypto.subtle.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  console.log("empty hash", hexFromU8(emptyHash));
  const derivedSecret = await hkdfExpandLabel(earlySecret, txtEnc2.encode("derived"), emptyHash, hashBytes, hashBits);
  console.log("derived secret", hexFromU8(derivedSecret));
  const handshakeSecret = await hkdfExtract(derivedSecret, sharedSecret, hashBits);
  console.log("handshake secret", hexFromU8(handshakeSecret));
  const clientSecret = await hkdfExpandLabel(handshakeSecret, txtEnc2.encode("c hs traffic"), hellosHash, hashBytes, hashBits);
  console.log("client secret", hexFromU8(clientSecret));
  const serverSecret = await hkdfExpandLabel(handshakeSecret, txtEnc2.encode("s hs traffic"), hellosHash, hashBytes, hashBits);
  console.log("server secret", hexFromU8(serverSecret));
  const clientHandshakeKey = await hkdfExpandLabel(clientSecret, txtEnc2.encode("key"), new Uint8Array(0), keyLength, hashBits);
  console.log("client handshake key", hexFromU8(clientHandshakeKey));
  const serverHandshakeKey = await hkdfExpandLabel(serverSecret, txtEnc2.encode("key"), new Uint8Array(0), keyLength, hashBits);
  console.log("server handshake key", hexFromU8(serverHandshakeKey));
  const clientHandshakeIV = await hkdfExpandLabel(clientSecret, txtEnc2.encode("iv"), new Uint8Array(0), 12, hashBits);
  console.log("client handshake iv", hexFromU8(clientHandshakeIV));
  const serverHandshakeIV = await hkdfExpandLabel(serverSecret, txtEnc2.encode("iv"), new Uint8Array(0), 12, hashBits);
  console.log("server handshake iv", hexFromU8(serverHandshakeIV));
  return { serverHandshakeKey, serverHandshakeIV, clientHandshakeKey, clientHandshakeIV };
}

// src/aesgcm.ts
var Decrypter = class {
  key;
  iv;
  ivDataView;
  recordsDecrypted = 0;
  constructor(key, initialIv) {
    this.key = key;
    this.iv = initialIv;
    this.ivDataView = new DataView(this.iv.buffer, this.iv.byteOffset, this.iv.byteLength);
  }
  async decrypt(cipherTextPlusAuthTag, authTagLength, additionalData) {
    const ivLength = this.iv.length;
    const authTagBits = authTagLength << 3;
    let ivLast32 = this.ivDataView.getUint32(ivLength - 4);
    ivLast32 ^= this.recordsDecrypted;
    this.ivDataView.setUint32(ivLength - 4, ivLast32);
    this.recordsDecrypted += 1;
    const algorithm = { name: "AES-GCM", iv: this.iv, tagLength: authTagBits, additionalData };
    const plainTextBuffer = await crypto.subtle.decrypt(algorithm, this.key, cipherTextPlusAuthTag);
    const plainText = new Uint8Array(plainTextBuffer);
    return plainText;
  }
};

// src/index.ts
var clientColour = "#8c8";
var serverColour = "#88c";
var headerColor = "#c88";
async function startTls(host, port) {
  const ecdhKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const rawPublicKey = await crypto.subtle.exportKey("raw", ecdhKeys.publicKey);
  const ws = await new Promise((resolve) => {
    const ws2 = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws2.binaryType = "arraybuffer";
    ws2.addEventListener("open", () => resolve(ws2));
  });
  const reader = new ReadQueue(ws);
  const clientHello = makeClientHello(host, rawPublicKey);
  console.log(...highlightCommented_default(clientHello.commentedString(), clientColour));
  const clientHelloData = clientHello.array();
  ws.send(clientHelloData);
  const serverHelloRecord = await readTlsRecord(reader, 22 /* Handshake */);
  const serverHello = new Bytes(serverHelloRecord.content);
  const serverRawPublicKey = parseServerHello(serverHello);
  console.log(...highlightCommented_default(serverHelloRecord.header.commentedString() + serverHello.commentedString(), serverColour));
  const changeCipherRecord = await readTlsRecord(reader, 20 /* ChangeCipherSpec */);
  const ccipher = new Bytes(changeCipherRecord.content);
  ccipher.expectUint8(1, "dummy ChangeCipherSpec payload (middlebox compatibility)");
  if (ccipher.remainingBytes() !== 0)
    throw new Error(`Unexpected additional data at end of ChangeCipherSpec`);
  console.log(...highlightCommented_default(changeCipherRecord.header.commentedString() + ccipher.commentedString(), serverColour));
  console.log("%c%s", `color: ${headerColor}`, "handshake key computations");
  const serverPublicKey = await crypto.subtle.importKey("raw", serverRawPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecretBuffer = await crypto.subtle.deriveBits({ name: "ECDH", public: serverPublicKey }, ecdhKeys.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  console.log("shared secret", hexFromU8(sharedSecret));
  const clientHelloContent = clientHelloData.subarray(5);
  const serverHelloContent = serverHelloRecord.content;
  const combinedContent = new Uint8Array(clientHelloContent.length + serverHelloContent.length);
  combinedContent.set(clientHelloContent);
  combinedContent.set(serverHelloContent, clientHelloContent.length);
  const hellosHashBuffer = await crypto.subtle.digest("SHA-256", combinedContent);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  console.log("hellos hash", hexFromU8(hellosHash));
  const handshakeKeys = await getHandshakeKeys(sharedSecret, hellosHash, 256, 16);
  const serverHandshakeKey = await crypto.subtle.importKey("raw", handshakeKeys.serverHandshakeKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const handshakeDecrypter = new Decrypter(serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const encrypted = await readTlsRecord(reader, 23 /* Application */);
  console.log(...highlightCommented_default(encrypted.header.commentedString(), serverColour));
  console.log("%s%c  %s", hexFromU8(encrypted.content), `color: ${serverColour}`, "encrypted payload + auth tag");
  const decrypted = await handshakeDecrypter.decrypt(encrypted.content, 16, encrypted.headerData);
  console.log("%s%c  %s", hexFromU8(decrypted), `color: ${serverColour}`, "decrypted payload");
}
startTls("google.com", 443);
