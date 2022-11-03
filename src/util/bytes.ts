
const textEncoder = new TextEncoder();

export default class Bytes {
  offset: number;
  dataView: DataView;
  uint8Array: Uint8Array;
  comments: Record<number, string>;

  constructor(arrayOrMaxBytes: number | Uint8Array) {
    this.offset = 0;
    this.uint8Array = typeof arrayOrMaxBytes === 'number' ? new Uint8Array(arrayOrMaxBytes) : arrayOrMaxBytes;
    this.dataView = new DataView(this.uint8Array.buffer, this.uint8Array.byteOffset, this.uint8Array.byteLength);
    this.comments = {};
  }

  remainingBytes() {
    return this.uint8Array.length - this.offset;
  }

  subarray(length: number) {
    // this advances the offset and returns a subarray for external writing (e.g. with crypto.getRandomValues()) or reading
    return this.uint8Array.subarray(this.offset, this.offset += length);
  }

  slice(length: number) {
    return this.uint8Array.slice(this.offset, this.offset += length);
  }

  skip(length: number, comment?: string) {
    this.offset += length;
    if (comment !== undefined) this.comment(comment);
    return this;
  }

  comment(s: string, offset = this.offset) {
    this.comments[offset] = s;
    return this;
  }

  // reading

  readUint8(comment?: string) {
    const result = this.dataView.getUint8(this.offset);
    this.offset += 1;
    if (comment !== undefined) this.comment(comment);
    return result;
  }

  readUint16(comment?: string) {
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    if (comment !== undefined) this.comment(comment);
    return result;
  }

  readUint24(comment?: string) {
    const msb = this.readUint8();
    const lsbs = this.readUint16(comment);
    return (msb << 16) + lsbs;
  }

  expectUint8(expectedValue: number, comment?: string) {
    const actualValue = this.readUint8();
    if (comment !== undefined) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }

  expectUint16(expectedValue: number, comment?: string) {
    const actualValue = this.readUint16();
    if (comment !== undefined) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }

  // writing

  writeBytes(bytes: number[] | Uint8Array) {
    this.uint8Array.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }

  writeUTF8String(s: string) {
    const bytes = textEncoder.encode(s);
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