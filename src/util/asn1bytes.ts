import { constructedUniversalTypeSequence, universalTypeBitString, universalTypeOctetString, universalTypeOID } from '../tls/certUtils';
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

  async readASN1OID(comment?: string) {
    await this.expectUint8(universalTypeOID, chatty && (comment ? `OID: ${comment}` : 'OID'));
    const [endOID, OIDRemaining] = await this.expectASN1Length(chatty && 'OID');
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
    const [endBoolean, booleanRemaining] = await this.expectASN1Length(chatty && 'boolean');
    const length = booleanRemaining();
    if (length !== 1) throw new Error(`Boolean has weird length: ${length}`);
    const byte = await this.readUint8();
    let result;
    if (byte === 0xff) result = true;
    else if (byte === 0x00) result = false;
    else throw new Error(`Boolean has weird value: 0x${hexFromU8([byte])}`);
    if (chatty && comment) this.comment(comment.replace(/%/g, String(result)));
    endBoolean();
    return result;
  }

  async readASN1UTCTime() {
    const [endTime, timeRemaining] = await this.expectASN1Length(chatty && 'UTC time');
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

  async readASN1GeneralizedTime() {
    const [endTime, timeRemaining] = await this.expectASN1Length(chatty && 'generalized time');
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

  async readASN1BitString(comment?: string) {
    await this.expectUint8(universalTypeBitString, chatty && (comment ? `bitstring: ${comment}` : 'bitstring'));
    const [endBitString, bitStringRemaining] = await this.expectASN1Length(comment);
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
    return bitString;
  }

  async expectASN1Sequence(comment?: string) {
    await this.expectUint8(constructedUniversalTypeSequence, chatty && (comment ? `sequence: ${comment}` : 'sequence'));
    return this.expectASN1Length(comment);
  }

  async expectASN1OctetString(comment?: string) {
    await this.expectUint8(universalTypeOctetString, chatty && (comment ? `octet string: ${comment}` : 'octet string'));
    return this.expectASN1Length(comment);
  }

  async expectASN1DERDoc() {
    return this.expectASN1OctetString(chatty && 'DER document');
  }
}
