export default class ByteWriter {
  offset: number;
  arrayBuffer: ArrayBuffer;
  dataView: DataView;
  uint8Array: Uint8Array;
  comments: Record<number, string>;
  textEncoder: TextEncoder;

  constructor(maxBytes: number) {
    this.offset = 0;
    this.arrayBuffer = new ArrayBuffer(maxBytes);
    this.dataView = new DataView(this.arrayBuffer);
    this.uint8Array = new Uint8Array(this.arrayBuffer);
    this.comments = {};
    this.textEncoder = new TextEncoder();
  }

  comment(s: string, offset = this.offset) {
    this.comments[offset] = s;
  }

  subarray(length: number) {
    return this.uint8Array.subarray(this.offset, this.offset += length);
  }

  writeBytes(bytes: number[] | Uint8Array) {
    this.uint8Array.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }

  writeString(s: string) {
    const bytes = this.textEncoder.encode(s);
    this.writeBytes(bytes);
    this.comment('"' + s + '"');
    return this;
  }

  writeUint8(...args: number[]): ByteWriter {
    for (const arg of args) {
      this.dataView.setUint8(this.offset, arg);
      this.offset += 1;
    }
    return this;
  }

  writeUint16(...args: number[]): ByteWriter {
    for (const arg of args) {
      this.dataView.setUint16(this.offset, arg);
      this.offset += 2;
    }
    return this;
  }

  lengthUint8(comment?: string): (() => void) {
    const { offset } = this;
    this.offset += 1;
    return () => {
      const length = this.offset - offset - 1;
      this.dataView.setUint8(offset, length);
      this.comment(`${length} bytes follow${comment ? `: ${comment}` : ''}`, offset + 1);
    };
  }

  lengthUint16(comment?: string): (() => void) {
    const { offset } = this;
    this.offset += 2;
    return () => {
      const length = this.offset - offset - 2;
      this.dataView.setUint16(offset, length);
      this.comment(`${length} bytes follow${comment ? `: ${comment}` : ''}`, offset + 2);
    };
  }

  lengthUint24(comment?: string): (() => void) {
    const { offset } = this;
    this.offset += 3;
    return () => {
      const length = this.offset - offset - 3;
      this.dataView.setUint8(offset, (length & 0xff0000) >> 16);
      this.dataView.setUint16(offset, length & 0xffff);
      this.comment(`${length} bytes follow${comment ? `: ${comment}` : ''}`, offset + 3);
    };
  }

  array() {
    return this.uint8Array.subarray(0, this.offset);
  }

  commentedString(s = '%c') {
    const css = ['color: #000'];
    for (let i = 0; i < this.offset; i++) {
      s += this.uint8Array[i].toString(16).padStart(2, '0') + ' ';
      const comment = this.comments[i + 1];
      if (comment !== undefined) {
        s += ` %c${comment}\n%c`;
        css.push('color: #888', 'color: #000');
      }
    }
    return [s, ...css];
  }
}