// src/util/highlightCommented.ts
function highlightCommented_default(s, colour) {
  const css = [];
  s = s.replace(/  .+$/gm, (m) => {
    css.push(`color: ${colour}`, "color: inherit");
    return `  %c${m}%c`;
  });
  return [s, ...css];
}

// src/util/bytewriter.ts
var ByteWriter = class {
  offset;
  arrayBuffer;
  dataView;
  uint8Array;
  comments;
  textEncoder;
  constructor(maxBytes) {
    this.offset = 0;
    this.arrayBuffer = new ArrayBuffer(maxBytes);
    this.dataView = new DataView(this.arrayBuffer);
    this.uint8Array = new Uint8Array(this.arrayBuffer);
    this.comments = {};
    this.textEncoder = new TextEncoder();
  }
  comment(s, offset = this.offset) {
    this.comments[offset] = s;
  }
  subarray(length) {
    return this.uint8Array.subarray(this.offset, this.offset += length);
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
      }
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
  const hello = new ByteWriter(1024);
  hello.writeUint8(22);
  hello.comment("record type: handshake");
  hello.writeUint8(3, 1);
  hello.comment("TLS protocol version 1.0");
  const endRecordHeader = hello.lengthUint16();
  hello.writeUint8(1);
  hello.comment("handshake type: client hello");
  const endHandshakeHeader = hello.lengthUint24();
  hello.writeUint8(3, 3);
  hello.comment("TLS version 1.2 (middlebox compatibility)");
  crypto.getRandomValues(hello.subarray(32));
  hello.comment("client random");
  const endSessionId = hello.lengthUint8("session ID");
  crypto.getRandomValues(hello.subarray(32));
  hello.comment("session ID (middlebox compatibility)");
  endSessionId();
  const endCiphers = hello.lengthUint16("ciphers");
  hello.writeUint8(19, 1);
  hello.comment("cipher: TLS_AES_128_GCM_SHA256");
  endCiphers();
  const endCompressionMethods = hello.lengthUint8("compression methods");
  hello.writeUint8(0);
  hello.comment("compression method: none");
  endCompressionMethods();
  const endExtensions = hello.lengthUint16("extensions");
  hello.writeUint8(0, 0);
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
  hello.writeUint8(0, 11);
  hello.comment("extension type: EC point formats");
  const endFormatTypesExt = hello.lengthUint16("formats data");
  const endFormatTypes = hello.lengthUint8("formats");
  hello.writeUint8(0);
  hello.comment("format: uncompressed");
  endFormatTypes();
  endFormatTypesExt();
  hello.writeUint8(0, 10);
  hello.comment("extension type: supported groups (curves)");
  const endGroupsExt = hello.lengthUint16("groups data");
  const endGroups = hello.lengthUint16("groups");
  hello.writeUint8(0, 23);
  hello.comment("curve secp256r1 (NIST P-256)");
  endGroups();
  endGroupsExt();
  hello.writeUint8(0, 13);
  hello.comment("extension type: signature algorithms");
  const endSigsExt = hello.lengthUint16("signature algorithms data");
  const endSigs = hello.lengthUint16("signature algorithms");
  hello.writeUint8(4, 3);
  hello.comment("ECDSA-SECP256r1-SHA256");
  endSigs();
  endSigsExt();
  hello.writeUint8(0, 43);
  hello.comment("extension type: supported TLS versions");
  const endVersionsExt = hello.lengthUint16("TLS versions data");
  const endVersions = hello.lengthUint8("TLS versions");
  hello.writeUint8(3, 4);
  hello.comment("TLS version 1.3");
  endVersions();
  endVersionsExt();
  hello.writeUint8(0, 51);
  hello.comment("extension type: key share");
  const endKeyShareExt = hello.lengthUint16("key share data");
  const endKeyShares = hello.lengthUint16("key shares");
  hello.writeUint8(0, 23);
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

// src/index.ts
async function startTls(host, port) {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const publicKey = await crypto.subtle.exportKey("raw", keys.publicKey);
  const hello = clientHello(host, publicKey);
  console.log(...highlightCommented_default(hello.commentedString(), "#aaa"));
  const ws = await new Promise((resolve) => {
    const ws2 = new WebSocket(`ws://localhost:9999/?name=${host}:${port}`);
    ws2.binaryType = "arraybuffer";
    ws2.addEventListener("open", () => resolve(ws2));
    ws2.addEventListener("message", (msg) => console.log(new Uint8Array(msg.data)));
  });
  const bytes = hello.array();
  console.log(bytes);
  ws.send(bytes);
}
startTls("google.com", 443);
