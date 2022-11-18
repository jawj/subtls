import Bytes from './bytes';
import { hexFromU8 } from './hex';

export class ASN1Bytes extends Bytes {

  readASN1Length(comment?: string) {
    const byte1 = this.readUint8();
    if (byte1 < 0x80) {
      this.comment(`${byte1} bytes${comment ? ` of ${comment}` : ''} follow (ASN.1)`);
      return byte1;  // highest bit unset: simple one-byte value
    }
    const lengthBytes = byte1 & 0x7f;
    const fullComment = `% bytes${comment ? ` of ${comment}` : ''} follow (ASN.1)`;
    if (lengthBytes === 1) return this.readUint8(fullComment);
    if (lengthBytes === 2) return this.readUint16(fullComment);
    if (lengthBytes === 3) return this.readUint24(fullComment);
    if (lengthBytes === 4) return this.readUint32(fullComment);
    throw new Error(`ASN.1 length fields are only supported up to 4 bytes (this one is ${lengthBytes} bytes)`);
  }

  expectASN1Length(comment?: string) {
    const length = this.readASN1Length(comment);
    return this.expectLength(length);
  }

  readASN1OID() {  // starting with length (i.e. after OID type value)
    const OIDLength = this.readASN1Length();
    const [endOID, OIDRemainingBytes] = this.expectLength(OIDLength);
    const byte1 = this.readUint8();
    let oid = `${Math.floor(byte1 / 40)}.${byte1 % 40}`;
    while (OIDRemainingBytes() > 0) {  // loop over numbers in OID
      let value = 0;
      while (true) {  // loop over bytes in number
        const nextByte = this.readUint8();
        value <<= 7;
        value += nextByte & 0x7f;
        if (nextByte < 0x80) break;
      }
      oid += `.${value}`;
    }
    this.comment(oid);
    endOID();
    return oid;
  }

  readASN1Boolean() {
    const length = this.readUint8('length of boolean');
    if (length !== 1) throw new Error(`Boolean has weird length: ${length}`);
    const [endBoolean] = this.expectLength(length);
    const byte = this.readUint8();
    let result;
    if (byte === 0xff) result = true;
    else if (byte === 0x00) result = false;
    else throw new Error(`Boolean has weird value: 0x${hexFromU8([byte])}`);
    this.comment(result.toString());
    endBoolean();
    return result;
  }

  readASN1UTCTime() {
    const timeLength = this.readASN1Length();
    const [endTime] = this.expectLength(timeLength);
    const timeStr = this.readUTF8String(timeLength);
    const parts = timeStr.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
    if (!parts) throw new Error('Unrecognised UTC time format in certificate validity');
    const [, yr2dstr, mth, dy, hr, min, sec] = parts;
    const yr2d = parseInt(yr2dstr, 10);
    const yr = yr2d + (yr2d >= 50 ? 1900 : 2000);
    const time = new Date(`${yr}-${mth}-${dy}T${hr}:${min}:${sec}Z`);  // ISO8601 should be safe to parse
    this.comment('= ' + time.toISOString());
    endTime();
    return time;
  }

  readASN1BitString() {
    const bitStringLength = this.readASN1Length();
    const [endBitString, bitStringBytesRemaining] = this.expectLength(bitStringLength);
    const rightPadBits = this.readUint8('right-padding bits');
    const bytesLength = bitStringBytesRemaining()
    const bitString = this.readBytes(bytesLength);
    if (rightPadBits > 7) throw new Error(`Invalid right pad value: ${rightPadBits}`);
    if (rightPadBits > 0) {  // (this was surprisingly hard to get right)
      const leftPadNext = 8 - rightPadBits;
      for (let i = bytesLength - 1; i > 0; i--) {
        bitString[i] = (0xff & (bitString[i - 1] << leftPadNext)) | (bitString[i] >>> rightPadBits);
      }
      bitString[0] = bitString[0] >>> rightPadBits;
    }
    endBitString();
    return bitString;
  }

}