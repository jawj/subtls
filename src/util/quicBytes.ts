import { Bytes } from './bytes';

export class QUICBytes extends Bytes {

  writeQUICInt(i: number, comment?: string) {  // TODO: support 8-byte integers using BigInt
    if (i < 64) this.writeUint8(i, comment);
    else if (i < 16384) this.writeUint16(16384 | i, comment);
    else if (i < 1073741824) this.writeUint32(1073741824 | i, comment);
    else throw new Error(`QUIC integer out of range: ${i}`);
  }

  async readQUICInt(comment?: string) {  // TODO: support 8-byte integers using BigInt
    const firstByte = await this.readUint8();
    const prefix = firstByte >>> 6;
    if (prefix === 3) throw new Error('8-byte QUIC integers are currently unsupported');
    let v = firstByte & 0x3f;
    let bytes = 1 << prefix;
    while (--bytes > 0) v = v << 8 | await this.readUint8();
    if (chatty && comment) this.comment(comment.replace(/%/g, String(v)));
    return v;
  }

  async expectQUICLength(comment?: string) {
    const length = await this.readQUICInt();
    chatty && this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }

  writeKnownQUICLength(length: number, comment?: string) {
    this.writeQUICInt(length, chatty && this.lengthComment(length, comment));
    const endOffset = this.offset;
    this.changeIndent(1);
    return () => {
      const actualLength = this.offset - endOffset;
      if (actualLength !== length) throw new Error(`QUIC length mismatch: expected ${length} bytes, got ${actualLength} bytes`);
      this.changeIndent(-1);
    };
  }

  writeQUICLength(comment?: string) {
    // number of bytes required is not known ahead of time: we reserve nothing and shift the written bytes forward when done
    const startOffset = this.offset;
    this.changeIndent(1);
    return () => {
      const dataLength = this.offset - startOffset;

      this.writeQUICInt(dataLength);  // write at end of data only to assess length
      const endOffset = this.offset;
      const lengthValueLength = endOffset - dataLength - startOffset;  // 1 - 8 bytes

      // copy data forward to make room for length value at start
      this.data.set(this.data.subarray(startOffset, endOffset - lengthValueLength), startOffset + lengthValueLength);

      // write length value at start
      this.offset = startOffset;
      this.changeIndent(-1);
      this.writeQUICInt(dataLength);
      this.changeIndent(1);

      // shift comments forward
      if (chatty) {
        const commentsToShiftForward = Object.entries(this.comments).filter(([key]) => {
          const offset = parseInt(key, 10);
          return offset > startOffset;
        });
        for (const [key] of commentsToShiftForward) delete this.comments[parseInt(key, 10)];  // remove comments that are now misplaced
        for (const [key, comment] of commentsToShiftForward) this.comments[parseInt(key, 10) + lengthValueLength] = comment;  // reinsert further forward

        this.comment(this.lengthComment(dataLength, comment));  // add comment to length value
      }

      this.offset = endOffset;
      this.changeIndent(-1);
      return lengthValueLength;
    };
  }

}