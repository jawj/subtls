import { equal } from './array';
import { indentChars } from '../presentation/appearance';

const initialSize = 1024;
const growthFactor = 2;

const txtEnc = new TextEncoder();
const txtDec = new TextDecoder();
const emptyArray = new Uint8Array(0);

export class Bytes {
  fetchFn: undefined | ((bytes: number) => Promise<Uint8Array | undefined>);
  endOfReadableData: number;  // how much data exists to read (not used for writing)
  offset: number;  // current read/write cursor
  dataView: DataView;
  data: Uint8Array;
  comments: Record<number, string>;
  indents: Record<number, number>;

  /**
   * @param data -
   * * If data is a `Uint8Array`, this is the initial data
   * * If data is a `number`, this is the initial size in bytes (all zeroes)
   * * If data is a `function`, this function is called to retrieve data when required
   */
  constructor(data?: Uint8Array | number | ((bytes: number) => Promise<Uint8Array | undefined>), public indent = 0) {
    this.endOfReadableData = this.offset = 0;

    this.comments = {};
    this.indents = { 0: indent };

    if (typeof data === 'number') {
      this.data = new Uint8Array(data);
    } else if (data === undefined || typeof data === 'function') {
      this.data = emptyArray;
      this.fetchFn = data;
    } else /* Uint8Array */ {
      this.data = data;
      this.endOfReadableData = data.length;
    }

    this.dataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }

  readRemaining() {
    return this.endOfReadableData - this.offset;
  }

  resizeTo(newSize: number) {
    const newData = new Uint8Array(newSize);
    newData.set(this.data);
    this.data = newData;
    this.dataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }

  async ensureReadAvailable(bytes: number) {
    if (bytes <= this.readRemaining()) return;
    if (this.fetchFn === undefined) throw new Error('Not enough data and no read function supplied');
    const freeSpace = this.data.length - this.endOfReadableData;
    if (bytes > freeSpace) {
      const newSize = Math.max(
        initialSize,
        this.data.length * growthFactor,
        this.endOfReadableData + bytes,
      );
      this.resizeTo(newSize);
    }
    const newData = await this.fetchFn(bytes);
    if (newData === undefined || newData.length < bytes) {
      const e = new Error(`Not enough data returned by read function. 
  data.length:       ${this.data.length}
  endOfReadableData: ${this.endOfReadableData}
  offset:            ${this.offset}
  bytes requested:   ${bytes}
  bytes returned:    ${newData && newData.length}`);
      (e as any)._bytes_error_reason = 'EOF';
      throw e;
    }
    this.data.set(newData, this.endOfReadableData);
    this.endOfReadableData += newData.length;
  }

  ensureWriteAvailable(bytes: number) {
    if (this.offset + bytes < this.data.length) return;
    const newSize = Math.max(
      initialSize,
      this.data.length * growthFactor,
      this.offset + bytes,
    );
    this.resizeTo(newSize);
  }

  expectLength(length: number, indentDelta = 1) {
    const startOffset = this.offset;
    const endOffset = startOffset + length;
    this.indent += indentDelta;
    this.indents[startOffset] = this.indent;
    return [
      () => {
        this.indent -= indentDelta;
        this.indents[this.offset] = this.indent;
        if (this.offset !== endOffset) throw new Error(`${length} bytes expected but ${this.offset - startOffset} advanced`);
      },
      () => endOffset - this.offset,
    ] as const;
  }

  comment(s: string, offset = this.offset) {
    if (!chatty) throw new Error('No comments should be emitted outside of chatty mode');
    const existing = this.comments[offset];
    const result = (existing === undefined ? '' : existing + ' ') + s;
    this.comments[offset] = result;
    return this;
  }

  lengthComment(length: number, comment?: string, inclusive = false) {
    return length === 1 ?
      `${length} byte${comment ? ` of ${comment}` : ''} ${inclusive ? 'starts here' : 'follows'}` :
      `${length === 0 ? 'no' : length} bytes${comment ? ` of ${comment}` : ''} ${inclusive ? 'start here' : 'follow'}`;
  }

  // reading

  async subarrayForRead(length: number) {
    // this advances the offset and returns a subarray for external reading
    await this.ensureReadAvailable(length);
    return this.data.subarray(this.offset, this.offset += length);
  }

  async skipRead(length: number, comment?: string) {
    await this.ensureReadAvailable(length);
    this.offset += length;
    if (comment) this.comment(comment);
    return this;
  }

  async readBytes(length: number) {
    await this.ensureReadAvailable(length);
    return this.data.slice(this.offset, this.offset += length);
  }

  async readUTF8String(length: number) {
    await this.ensureReadAvailable(length);
    const bytes = await this.subarrayForRead(length);
    const s = txtDec.decode(bytes);
    chatty && this.comment('"' + s.replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"');
    return s;
  }

  async readUTF8StringNullTerminated() {
    let i = 0;
    while (true) {
      await this.ensureReadAvailable(i + 1);
      const charCode = this.data[this.offset + i];
      if (charCode === 0) break;
      i++;
    };
    const str = await this.readUTF8String(i);
    await this.expectUint8(0x00, 'end of string');
    return str;
  }

  async readUint8(comment?: string) {
    await this.ensureReadAvailable(1);
    const result = this.dataView.getUint8(this.offset);
    this.offset += 1;
    if (chatty && comment) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }

  async readUint16(comment?: string) {
    await this.ensureReadAvailable(2);
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    if (chatty && comment) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }

  async readUint24(comment?: string) {
    await this.ensureReadAvailable(3);
    const msb = await this.readUint8();
    const lsbs = await this.readUint16();
    const result = (msb << 16) + lsbs;
    if (chatty && comment) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }

  async readUint32(comment?: string) {
    await this.ensureReadAvailable(4);
    const result = this.dataView.getUint32(this.offset);
    this.offset += 4;
    if (chatty && comment) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }

  async expectBytes(expected: Uint8Array | number[], comment?: string) {
    await this.ensureReadAvailable(expected.length);
    const actual = await this.readBytes(expected.length);
    if (chatty && comment) this.comment(comment);
    if (!equal(actual, expected)) throw new Error('Unexpected bytes');
  }

  async expectUint8(expectedValue: number, comment?: string) {
    const actualValue = await this.readUint8();
    if (chatty && comment) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }

  async expectUint16(expectedValue: number, comment?: string) {
    const actualValue = await this.readUint16();
    if (chatty && comment) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }

  async expectUint24(expectedValue: number, comment?: string) {
    const actualValue = await this.readUint24();
    if (chatty && comment) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }

  async expectUint32(expectedValue: number, comment?: string) {
    const actualValue = await this.readUint32();
    if (chatty && comment) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }

  async expectReadLength(length: number, indentDelta = 1) {
    await this.ensureReadAvailable(length);
    return this.expectLength(length, indentDelta);
  }

  async expectLengthUint8(comment?: string) {
    const length = await this.readUint8();
    chatty && this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }

  async expectLengthUint16(comment?: string) {
    const length = await this.readUint16();
    chatty && this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }

  async expectLengthUint24(comment?: string) {
    const length = await this.readUint24();
    chatty && this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }

  async expectLengthUint32(comment?: string) {
    const length = await this.readUint32();
    chatty && this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }

  async expectLengthUint8Incl(comment?: string) {
    const length = await this.readUint8();
    chatty && this.comment(this.lengthComment(length, comment, true));
    return this.expectReadLength(length - 1);
  }

  async expectLengthUint16Incl(comment?: string) {
    const length = await this.readUint16();
    chatty && this.comment(this.lengthComment(length, comment, true));
    return this.expectReadLength(length - 2);
  }

  async expectLengthUint24Incl(comment?: string) {
    const length = await this.readUint24();
    chatty && this.comment(this.lengthComment(length, comment, true));
    return this.expectReadLength(length - 3);
  }

  async expectLengthUint32Incl(comment?: string) {
    const length = await this.readUint32();
    chatty && this.comment(this.lengthComment(length, comment, true));
    return this.expectReadLength(length - 4);
  }

  // writing

  subarrayForWrite(length: number) {
    // this advances the offset and returns a subarray for external writing (e.g. with crypto.getRandomValues())
    this.ensureWriteAvailable(length);
    return this.data.subarray(this.offset, this.offset += length);
  }

  skipWrite(length: number, comment?: string) {
    this.ensureWriteAvailable(length);
    this.offset += length;
    if (comment) this.comment(comment);
    return this;
  }

  writeBytes(bytes: number[] | Uint8Array) {
    this.ensureWriteAvailable(bytes.length);
    this.data.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }

  writeUTF8String(s: string) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    chatty && this.comment('"' + s.replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"');
    return this;
  }

  writeUTF8StringNullTerminated(s: string) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    chatty && this.comment('"' + s.replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"');
    this.writeUint8(0x00);
    chatty && this.comment('end of string');
    return this;
  }

  writeUint8(value: number, comment?: string): Bytes {
    this.ensureWriteAvailable(1);
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
    if (chatty && comment) this.comment(comment);
    return this;
  }

  writeUint16(value: number, comment?: string): Bytes {
    this.ensureWriteAvailable(2);
    this.dataView.setUint16(this.offset, value);
    this.offset += 2;
    if (chatty && comment) this.comment(comment);
    return this;
  }

  writeUint24(value: number, comment?: string): Bytes {
    this.writeUint8((value & 0xff0000) >> 16);
    this.writeUint16(value & 0x00ffff, comment);
    return this;
  }

  writeUint32(value: number, comment?: string): Bytes {
    this.ensureWriteAvailable(4);
    this.dataView.setUint32(this.offset, value);
    this.offset += 4;
    if (chatty && comment) this.comment(comment);
    return this;
  }

  // forward-looking lengths

  _writeLengthGeneric(lengthBytes: number, inclusive: boolean, comment?: string) {
    this.ensureWriteAvailable(lengthBytes);
    const startOffset = this.offset;
    this.offset += lengthBytes;
    const endOffset = this.offset;
    this.indent += 1;
    this.indents[endOffset] = this.indent;
    return () => {
      const length = this.offset - (inclusive ? startOffset : endOffset);
      switch (lengthBytes) {
        case 1:
          this.dataView.setUint8(startOffset, length);
          break;
        case 2:
          this.dataView.setUint16(startOffset, length);
          break;
        case 3:
          this.dataView.setUint8(startOffset, (length & 0xff0000) >> 16);
          this.dataView.setUint16(startOffset + 1, length & 0xffff);
          break;
        case 4:
          this.dataView.setUint32(startOffset, length);
          break;
        default:
          throw new Error(`Invalid length for length field: ${lengthBytes}`);
      }
      chatty && this.comment(this.lengthComment(length, comment, inclusive), endOffset);
      this.indent -= 1;
      this.indents[this.offset] = this.indent;
    };
  }

  writeLengthUint8(comment?: string) {
    return this._writeLengthGeneric(1, false, comment);
  }

  writeLengthUint16(comment?: string) {
    return this._writeLengthGeneric(2, false, comment);
  }

  writeLengthUint24(comment?: string) {
    return this._writeLengthGeneric(3, false, comment);
  }

  writeLengthUint32(comment?: string) {
    return this._writeLengthGeneric(4, false, comment);
  }

  writeLengthUint8Incl(comment?: string) {
    return this._writeLengthGeneric(1, true, comment);
  }

  writeLengthUint16Incl(comment?: string) {
    return this._writeLengthGeneric(2, true, comment);
  }

  writeLengthUint24Incl(comment?: string) {
    return this._writeLengthGeneric(3, true, comment);
  }

  writeLengthUint32Incl(comment?: string) {
    return this._writeLengthGeneric(4, true, comment);
  }

  expectWriteLength(length: number, indentDelta = 1) {
    this.ensureWriteAvailable(length);
    return this.expectLength(length, indentDelta);
  }

  // output

  array() {
    return this.data.subarray(0, this.offset);
  }

  commentedString(all = false) {
    let indent = this.indents[0] ?? 0;
    let s = indentChars.repeat(indent);
    const len = all ? this.data.length : this.offset;
    for (let i = 0; i < len; i++) {
      s += this.data[i].toString(16).padStart(2, '0') + ' ';
      const comment = this.comments[i + 1];
      indent = this.indents[i + 1] ?? indent;
      if (comment) {
        s += ` ${comment}`;
        if (i < len - 1) s += `\n${indentChars.repeat(indent)}`;
      }
    }
    return s;
  }
}