// src/bytewriter.ts
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
  writeString(s) {
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
  lengthUint8(comment) {
    const { offset } = this;
    this.offset += 1;
    return () => {
      const length = this.offset - offset - 1;
      this.dataView.setUint8(offset, length);
      this.comment(`${length} bytes follow${comment ? `: ${comment}` : ""}`, offset + 1);
    };
  }
  lengthUint16(comment) {
    const { offset } = this;
    this.offset += 2;
    return () => {
      const length = this.offset - offset - 2;
      this.dataView.setUint16(offset, length);
      this.comment(`${length} bytes follow${comment ? `: ${comment}` : ""}`, offset + 2);
    };
  }
  lengthUint24(comment) {
    const { offset } = this;
    this.offset += 3;
    return () => {
      const length = this.offset - offset - 3;
      this.dataView.setUint8(offset, (length & 16711680) >> 16);
      this.dataView.setUint16(offset, length & 65535);
      this.comment(`${length} bytes follow${comment ? `: ${comment}` : ""}`, offset + 3);
    };
  }
  array() {
    return this.uint8Array.subarray(0, this.offset);
  }
  commentedString(s = "%c") {
    const css = ["color: #000"];
    for (let i = 0; i < this.offset; i++) {
      s += this.uint8Array[i].toString(16).padStart(2, "0") + " ";
      const comment = this.comments[i + 1];
      if (comment !== void 0) {
        s += ` %c${comment}
%c`;
        css.push("color: #888", "color: #000");
      }
    }
    return [s, ...css];
  }
};

// src/index.ts
async function startTls(host) {
  const hello = new ByteWriter(1024);
  hello.writeUint8(22);
  hello.comment("record type: handshake");
  hello.writeUint8(3, 1);
  hello.comment("TLS version 1.0");
  const endRecordHeader = hello.lengthUint16("complete record");
  hello.writeUint8(1);
  hello.comment("handshake type: client hello");
  const endHandshakeHeader = hello.lengthUint24();
  hello.writeUint8(3, 3);
  hello.comment("TLS 1.2 (for compatibility)");
  crypto.getRandomValues(hello.subarray(32));
  hello.comment("client random");
  const endSessionId = hello.lengthUint8("session ID");
  crypto.getRandomValues(hello.subarray(32));
  hello.comment("session ID");
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
  const endSNI = hello.lengthUint16("SNI records");
  const endSNIItem = hello.lengthUint16("SNI record");
  hello.writeUint8(0);
  hello.comment("list entry type: DNS hostname");
  const endHostname = hello.lengthUint16("hostname");
  hello.writeString(host);
  endHostname();
  endSNIItem();
  endSNI();
  hello.writeUint8(0, 11);
  hello.comment("extension type: EC point formats");
  const endFormatTypes = hello.lengthUint16("format types");
  const endFormatTypes2 = hello.lengthUint8("format types");
  hello.writeUint8(0);
  hello.comment("format: uncompressed");
  endFormatTypes2();
  endFormatTypes();
  endExtensions();
  endHandshakeHeader();
  endRecordHeader();
  console.log(hello.array());
  console.log(...hello.commentedString());
}
startTls("neon.tech");
