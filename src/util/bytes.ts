import { equal } from './array';

const txtEnc = new TextEncoder();
const txtDec = new TextDecoder();

export const indentChars = '·· ';  // careful: this has complex interactions with highlightCommented

export default class Bytes {
  offset: number;
  dataView: DataView;
  uint8Array: Uint8Array;
  comments: Record<number, string>;
  indents: Record<number, number>;
  indent: number;

  constructor(arrayOrMaxBytes: number | Uint8Array) {
    this.offset = 0;
    this.uint8Array = typeof arrayOrMaxBytes === 'number' ? new Uint8Array(arrayOrMaxBytes) : arrayOrMaxBytes;
    this.dataView = new DataView(this.uint8Array.buffer, this.uint8Array.byteOffset, this.uint8Array.byteLength);
    this.comments = {};
    this.indents = {};
    this.indent = 0;
  }

  remainingBytes() {
    return this.uint8Array.length - this.offset;
  }

  subarray(length: number) {
    // this advances the offset and returns a subarray for external writing (e.g. with crypto.getRandomValues()) or reading
    return this.uint8Array.subarray(this.offset, this.offset += length);
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

  readBytes(length: number) {
    return this.uint8Array.slice(this.offset, this.offset += length);
  }

  readUTF8String(length: number) {
    const bytes = this.subarray(length);
    const s = txtDec.decode(bytes);
    this.comment('"' + s.replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"');
    return s;
  }

  readUint8(comment?: string) {
    const result = this.dataView.getUint8(this.offset);
    this.offset += 1;
    if (comment !== undefined) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }

  readUint16(comment?: string) {
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    if (comment !== undefined) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }

  readUint24(comment?: string) {
    const msb = this.readUint8();
    const lsbs = this.readUint16();
    const result = (msb << 16) + lsbs;
    if (comment !== undefined) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }

  readUint32(comment?: string) {
    const result = this.dataView.getUint32(this.offset);
    this.offset += 4;
    if (comment !== undefined) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }

  expectBytes(expected: Uint8Array | number[], comment?: string) {
    const actual = this.readBytes(expected.length);
    if (comment !== undefined) this.comment(comment);
    if (!equal(actual, expected)) throw new Error(`Unexpected bytes`);
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

  expectUint24(expectedValue: number, comment?: string) {
    const actualValue = this.readUint24();
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
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    this.comment('"' + s.replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"');
    return this;
  }

  writeUint8(value: number, comment?: string): Bytes {
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
    if (comment !== undefined) this.comment(comment);
    return this;
  }

  writeUint16(value: number, comment?: string): Bytes {
    this.dataView.setUint16(this.offset, value);
    this.offset += 2;
    if (comment !== undefined) this.comment(comment);
    return this;
  }

  // forward-looking lengths

  _writeLengthGeneric(lengthBytes: 1 | 2 | 3, comment?: string) {
    const startOffset = this.offset;
    this.offset += lengthBytes;
    const endOffset = this.offset;
    this.indent += 1;
    this.indents[endOffset] = this.indent;
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
      this.indent -= 1;
      this.indents[this.offset] = this.indent;
    };
  }

  writeLengthUint8(comment?: string) {
    return this._writeLengthGeneric(1, comment);
  }

  writeLengthUint16(comment?: string) {
    return this._writeLengthGeneric(2, comment);
  }

  writeLengthUint24(comment?: string) {
    return this._writeLengthGeneric(3, comment);
  }

  // output

  array() {
    return this.uint8Array.subarray(0, this.offset);
  }

  commentedString(all = false) {
    let s = '';
    let indent = 0;
    const len = all ? this.uint8Array.length : this.offset;
    for (let i = 0; i < len; i++) {
      s += this.uint8Array[i].toString(16).padStart(2, '0') + ' ';
      const comment = this.comments[i + 1];
      if (this.indents[i + 1] !== undefined) indent = this.indents[i + 1];
      if (comment !== undefined) s += ` ${comment}\n${indentChars.repeat(indent)}`;
    }
    return s;
  }
}