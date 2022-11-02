export default class Bytes {
  offset: number;
  arrayBuffer: ArrayBuffer;
  dataView: DataView;
  uint8Array: Uint8Array;
  comments: Record<number, string>;
  textEncoder: TextEncoder;

  constructor(arrayOrMaxBytes: number | Uint8Array) {
    this.offset = 0;
    this.uint8Array = typeof arrayOrMaxBytes === 'number' ? new Uint8Array(arrayOrMaxBytes) : arrayOrMaxBytes;
    this.arrayBuffer = this.uint8Array.buffer;
    this.dataView = new DataView(this.arrayBuffer);
    this.comments = {};
    this.textEncoder = new TextEncoder();
  }

  subarray(length: number) {
    // this advances the offset and returns a subarray for external writing (e.g. with crypto.getRandomValues()) or reading
    return this.uint8Array.subarray(this.offset, this.offset += length);
  }

  comment(s: string, offset = this.offset) {
    this.comments[offset] = s;
  }

  // reading

  readUint8() {
    const result = this.dataView.getUint8(this.offset);
    this.offset += 1;
    return result;
  }

  readUint16() {
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    return result;
  }

  // writing

  writeBytes(bytes: number[] | Uint8Array) {
    this.uint8Array.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }

  writeUTF8String(s: string) {
    const bytes = this.textEncoder.encode(s);
    this.writeBytes(bytes);
    this.comment('"' + s + '"');
    return this;
  }

  writeUint8(...args: number[]): Bytes {
    for (const arg of args) {
      this.dataView.setUint8(this.offset, arg);
      this.offset += 1;
    }
    return this;
  }

  writeUint16(...args: number[]): Bytes {
    for (const arg of args) {
      this.dataView.setUint16(this.offset, arg);
      this.offset += 2;
    }
    return this;
  }

  // forward-looking lengths

  _lengthGeneric(lengthBytes: 1 | 2 | 3, comment?: string) {
    const startOffset = this.offset;
    this.offset += lengthBytes;
    const endOffset = this.offset;
    return () => {
      const length = this.offset - endOffset;
      if (lengthBytes === 1) this.dataView.setUint8(startOffset, length);
      else if (lengthBytes === 2) this.dataView.setUint16(startOffset, length);
      else if (lengthBytes === 3) {
        this.dataView.setUint8(startOffset, (length & 0xff0000) >> 16);
        this.dataView.setUint16(startOffset + 1, length & 0xffff);
      }
      else throw new Error(`Invalid length for length field: ${lengthBytes}`);
      this.comment(`${length} bytes${comment ? ` of ${comment}` : ''} follow`, endOffset);
    };
  }

  lengthUint8(comment?: string) {
    return this._lengthGeneric(1, comment);
  }

  lengthUint16(comment?: string) {
    return this._lengthGeneric(2, comment);
  }

  lengthUint24(comment?: string) {
    return this._lengthGeneric(3, comment);
  }

  // output

  array() {
    return this.uint8Array.subarray(0, this.offset);
  }

  commentedString(s = '') {
    for (let i = 0; i < this.offset; i++) {
      s += this.uint8Array[i].toString(16).padStart(2, '0') + ' ';
      const comment = this.comments[i + 1];
      if (comment !== undefined) s += ` ${comment}\n`;
    }
    return s;
  }
}