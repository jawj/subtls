import { constructedUniversalTypeSequence, universalTypeBitString, universalTypeBoolean, universalTypeGeneralizedTime, universalTypeNull, universalTypeOctetString, universalTypeOID, universalTypeUTCTime } from '../tls/certUtils';
import { Bytes } from './bytes';
import { hexFromU8 } from './hex';

export class ASN1Bytes extends Bytes {

  async readASN1Length(comment?: string) {
    const byte1 = await this.readUint8();
    if (byte1 < 0x80) {
      chatty && this.comment(`${byte1} bytes${comment ? ` of ${comment}` : ''} follow (ASN.1)`);
      return byte1;  // highest bit unset: simple one-byte value
    }
    const lengthBytes = byte1 & 0x7f;
    const fullComment = chatty && `% bytes${comment ? ` of ${comment}` : ''} follow (ASN.1)`;
    if (lengthBytes === 1) return this.readUint8(fullComment);
    if (lengthBytes === 2) return this.readUint16(fullComment);
    if (lengthBytes === 3) return this.readUint24(fullComment);
    if (lengthBytes === 4) return this.readUint32(fullComment);
    throw new Error(`ASN.1 length fields are only supported up to 4 bytes (this one is ${lengthBytes} bytes)`);
  }

  async expectASN1Length(comment?: string) {
    const length = await this.readASN1Length(comment);
    return this.expectReadLength(length);
  }

  async expectASN1TypeAndLength(typeNum: number, typeDesc: string, comment?: string) {
    await this.expectUint8(typeNum, chatty && (comment ? `${typeDesc}: ${comment}` : typeDesc));
    return this.expectASN1Length(chatty && typeDesc);
  }

  async readASN1OID(comment?: string) {
    const [endOID, OIDRemaining] = await this.expectASN1TypeAndLength(universalTypeOID, 'OID', comment);
    const byte1 = await this.readUint8();
    let oid = `${Math.floor(byte1 / 40)}.${byte1 % 40}`;
    while (OIDRemaining() > 0) {  // loop over numbers in OID
      let value = 0;
      while (true) {  // loop over bytes in number
        const nextByte = await this.readUint8();
        value <<= 7;
        value += nextByte & 0x7f;
        if (nextByte < 0x80) break;
      }
      oid += `.${value}`;
    }
    chatty && this.comment(oid);
    endOID();
    return oid;
  }

  async readASN1Boolean(comment?: string) {
    const [endBoolean, booleanRemaining] = await this.expectASN1TypeAndLength(universalTypeBoolean, 'boolean', comment);
    const length = booleanRemaining();
    if (length !== 1) throw new Error(`Boolean has unexpected length: ${length}`);
    const byte = await this.readUint8();
    const result = {
      0xff: true,
      0x00: false,
    }[byte];
    if (result === undefined) throw new Error(`Boolean has unexpected value: 0x${hexFromU8([byte])}`);
    chatty && this.comment(String(result));
    endBoolean();
    return result;
  }

  async readASN1UTCTime(comment?: string) {
    const [endTime, timeRemaining] = await this.expectASN1TypeAndLength(universalTypeUTCTime, 'UTC time', comment);
    const timeStr = await this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
    if (!parts) throw new Error('Unrecognised ASN.1 UTC time format');
    const [, yr2dstr, mth, dy, hr, min, sec] = parts;
    const yr2d = parseInt(yr2dstr, 10);
    const yr = yr2d + (yr2d >= 50 ? 1900 : 2000);  // range is 1950 – 2049
    const time = new Date(`${yr}-${mth}-${dy}T${hr}:${min}:${sec}Z`);  // ISO8601 should be safe to parse
    chatty && this.comment('= ' + time.toISOString());
    endTime();
    return time;
  }

  async readASN1GeneralizedTime(comment?: string) {
    const [endTime, timeRemaining] = await this.expectASN1TypeAndLength(universalTypeGeneralizedTime, 'generalized time', comment);
    const timeStr = await this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})?([0-9]{2})?([.][0-9]+)?(Z)?([-+][0-9]+)?$/);
    if (!parts) throw new Error('Unrecognised ASN.1 generalized time format');
    const [, yr, mth, dy, hr, min, sec, fracsec, z, tz] = parts;
    if (sec === undefined && fracsec !== undefined) throw new Error('Invalid ASN.1 generalized time format (fraction without seconds)');
    if (z !== undefined && tz !== undefined) throw new Error('Invalid ASN.1 generalized time format (Z and timezone)');
    const time = new Date(`${yr}-${mth}-${dy}T${hr}:${min ?? '00'}:${sec ?? '00'}${fracsec ?? ''}${tz ?? 'Z'}`);  // ISO8601 should be safe to parse
    chatty && this.comment('= ' + time.toISOString());
    endTime();
    return time;
  }

  async readASN1Time(comment?: string) {
    const startTimeType = await this.readUint8();
    this.offset--;  // backtrack so type can be re-read
    let t;
    if (startTimeType === universalTypeUTCTime) {
      t = await this.readASN1UTCTime(comment);
    } else if (startTimeType === universalTypeGeneralizedTime) {
      t = await this.readASN1GeneralizedTime(comment);
    } else {
      throw new Error(`Expected time type but got 0x${hexFromU8([startTimeType])}`);
    }
    return t;
  }

  async readASN1BitString(comment?: string) {
    const [endBitString, bitStringRemaining] = await this.expectASN1TypeAndLength(universalTypeBitString, 'bitstring', comment);
    const rightPadBits = await this.readUint8(chatty && 'right-padding bits');
    const bytesLength = bitStringRemaining();
    const bitString = await this.readBytes(bytesLength);
    if (rightPadBits > 7) throw new Error(`Invalid right pad value: ${rightPadBits}`);
    if (rightPadBits > 0) {  // (this was surprisingly hard to get right)
      const leftPadNext = 8 - rightPadBits;
      for (let i = bytesLength - 1; i > 0; i--) {
        bitString[i] = (0xff & (bitString[i - 1] << leftPadNext)) | (bitString[i] >>> rightPadBits);
      }
      bitString[0] = bitString[0] >>> rightPadBits;
    }
    endBitString();
    comment && this.comment(comment);
    return bitString;
  }

  async expectASN1Sequence(comment?: string) {
    return this.expectASN1TypeAndLength(constructedUniversalTypeSequence, 'sequence', comment);
  }

  async expectASN1OctetString(comment?: string) {
    return this.expectASN1TypeAndLength(universalTypeOctetString, 'octet string', comment);
  }

  async expectASN1DERDoc() {
    return this.expectASN1OctetString(chatty && 'DER document');
  }

  async expectASN1Null() {
    await this.expectUint8(universalTypeNull, chatty && 'null type');
    await this.expectUint8(0x00, chatty && 'null length');
  }
}
