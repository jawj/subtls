import { Bytes } from './bytes';

const te = new TextEncoder();
const H = [
  [0b1111111111000, 13],
  [0b11111111111111111011000, 23],
  [0b1111111111111111111111100010, 28],
  [0b1111111111111111111111100011, 28],
  [0b1111111111111111111111100100, 28],
  [0b1111111111111111111111100101, 28],
  [0b1111111111111111111111100110, 28],
  [0b1111111111111111111111100111, 28],
  [0b1111111111111111111111101000, 28],
  [0b111111111111111111101010, 24],
  [0b111111111111111111111111111100, 30],
  [0b1111111111111111111111101001, 28],
  [0b1111111111111111111111101010, 28],
  [0b111111111111111111111111111101, 30],
  [0b1111111111111111111111101011, 28],
  [0b1111111111111111111111101100, 28],
  [0b1111111111111111111111101101, 28],
  [0b1111111111111111111111101110, 28],
  [0b1111111111111111111111101111, 28],
  [0b1111111111111111111111110000, 28],
  [0b1111111111111111111111110001, 28],
  [0b1111111111111111111111110010, 28],
  [0b111111111111111111111111111110, 30],
  [0b1111111111111111111111110011, 28],
  [0b1111111111111111111111110100, 28],
  [0b1111111111111111111111110101, 28],
  [0b1111111111111111111111110110, 28],
  [0b1111111111111111111111110111, 28],
  [0b1111111111111111111111111000, 28],
  [0b1111111111111111111111111001, 28],
  [0b1111111111111111111111111010, 28],
  [0b1111111111111111111111111011, 28],
  [0b010100, 6],
  [0b1111111000, 10],  // !
  [0b1111111001, 10],  // "
  [0b111111111010, 12],  // #
  [0b1111111111001, 13],  // $
  [0b010101, 6],  // %
  [0b11111000, 8],  // &
  [0b11111111010, 11],  // '
  [0b1111111010, 10],  // (
  [0b1111111011, 10],  // )
  [0b11111001, 8],  // *
  [0b11111111011, 11],  // +
  [0b11111010, 8],  // ,
  [0b010110, 6],  // -
  [0b010111, 6],  // .
  [0b011000, 6],  // /
  [0b00000, 5],  // 0
  [0b00001, 5],  // 1
  [0b00010, 5],  // 2
  [0b011001, 6],  // 3
  [0b011010, 6],  // 4
  [0b011011, 6],  // 5
  [0b011100, 6],  // 6
  [0b011101, 6],  // 7
  [0b011110, 6],  // 8
  [0b011111, 6],  // 9
  [0b1011100, 7],  // :
  [0b11111011, 8],  // ;
  [0b111111111111100, 15],  // <
  [0b100000, 6],  // =
  [0b111111111011, 12],  // >
  [0b1111111100, 10],  // ?
  [0b1111111111010, 13],  // @
  [0b100001, 6],  // A
  [0b1011101, 7],  // B
  [0b1011110, 7],  // C
  [0b1011111, 7],  // D
  [0b1100000, 7],  // E
  [0b1100001, 7],  // F
  [0b1100010, 7],  // G
  [0b1100011, 7],  // H
  [0b1100100, 7],  // I
  [0b1100101, 7],  // J
  [0b1100110, 7],  // K
  [0b1100111, 7],  // L
  [0b1101000, 7],  // M
  [0b1101001, 7],  // N
  [0b1101010, 7],  // O
  [0b1101011, 7],  // P
  [0b1101100, 7],  // Q
  [0b1101101, 7],  // R
  [0b1101110, 7],  // S
  [0b1101111, 7],  // T
  [0b1110000, 7],  // U
  [0b1110001, 7],  // V
  [0b1110010, 7],  // W
  [0b11111100, 8],  // X
  [0b1110011, 7],  // Y
  [0b11111101, 8],  // Z
  [0b1111111111011, 13],  // [
  [0b1111111111111110000, 19],  // \
  [0b1111111111100, 13],  // ]
  [0b11111111111100, 14],  // ^
  [0b100010, 6],  // _
  [0b111111111111101, 15],  // `
  [0b00011, 5],  // a
  [0b100011, 6],  // b
  [0b00100, 5],  // c
  [0b100100, 6],  // d
  [0b00101, 5],  // e
  [0b100101, 6],  // f
  [0b100110, 6],  // g
  [0b100111, 6],  // h
  [0b00110, 5],  // i
  [0b1110100, 7],  // j
  [0b1110101, 7],  // k
  [0b101000, 6],  // l
  [0b101001, 6],  // m
  [0b101010, 6],  // n
  [0b00111, 5],  // o
  [0b101011, 6],  // p
  [0b1110110, 7],  // q
  [0b101100, 6],  // r
  [0b01000, 5],  // s
  [0b01001, 5],  // t
  [0b101101, 6],  // u
  [0b1110111, 7],  // v
  [0b1111000, 7],  // w
  [0b1111001, 7],  // x
  [0b1111010, 7],  // y
  [0b1111011, 7],  // z
  [0b111111111111110, 15],  // {
  [0b11111111100, 11],  // |
  [0b11111111111101, 14],  // }
  [0b1111111111101, 13],  // ~
  [0b1111111111111111111111111100, 28],
  [0b11111111111111100110, 20],
  [0b1111111111111111010010, 22],
  [0b11111111111111100111, 20],
  [0b11111111111111101000, 20],
  [0b1111111111111111010011, 22],
  [0b1111111111111111010100, 22],
  [0b1111111111111111010101, 22],
  [0b11111111111111111011001, 23],
  [0b1111111111111111010110, 22],
  [0b11111111111111111011010, 23],
  [0b11111111111111111011011, 23],
  [0b11111111111111111011100, 23],
  [0b11111111111111111011101, 23],
  [0b11111111111111111011110, 23],
  [0b111111111111111111101011, 24],
  [0b11111111111111111011111, 23],
  [0b111111111111111111101100, 24],
  [0b111111111111111111101101, 24],
  [0b1111111111111111010111, 22],
  [0b11111111111111111100000, 23],
  [0b111111111111111111101110, 24],
  [0b11111111111111111100001, 23],
  [0b11111111111111111100010, 23],
  [0b11111111111111111100011, 23],
  [0b11111111111111111100100, 23],
  [0b111111111111111011100, 21],
  [0b1111111111111111011000, 22],
  [0b11111111111111111100101, 23],
  [0b1111111111111111011001, 22],
  [0b11111111111111111100110, 23],
  [0b11111111111111111100111, 23],
  [0b111111111111111111101111, 24],
  [0b1111111111111111011010, 22],
  [0b111111111111111011101, 21],
  [0b11111111111111101001, 20],
  [0b1111111111111111011011, 22],
  [0b1111111111111111011100, 22],
  [0b11111111111111111101000, 23],
  [0b11111111111111111101001, 23],
  [0b111111111111111011110, 21],
  [0b11111111111111111101010, 23],
  [0b1111111111111111011101, 22],
  [0b1111111111111111011110, 22],
  [0b111111111111111111110000, 24],
  [0b111111111111111011111, 21],
  [0b1111111111111111011111, 22],
  [0b11111111111111111101011, 23],
  [0b11111111111111111101100, 23],
  [0b111111111111111100000, 21],
  [0b111111111111111100001, 21],
  [0b1111111111111111100000, 22],
  [0b111111111111111100010, 21],
  [0b11111111111111111101101, 23],
  [0b1111111111111111100001, 22],
  [0b11111111111111111101110, 23],
  [0b11111111111111111101111, 23],
  [0b11111111111111101010, 20],
  [0b1111111111111111100010, 22],
  [0b1111111111111111100011, 22],
  [0b1111111111111111100100, 22],
  [0b11111111111111111110000, 23],
  [0b1111111111111111100101, 22],
  [0b1111111111111111100110, 22],
  [0b11111111111111111110001, 23],
  [0b11111111111111111111100000, 26],
  [0b11111111111111111111100001, 26],
  [0b11111111111111101011, 20],
  [0b1111111111111110001, 19],
  [0b1111111111111111100111, 22],
  [0b11111111111111111110010, 23],
  [0b1111111111111111101000, 22],
  [0b1111111111111111111101100, 25],
  [0b11111111111111111111100010, 26],
  [0b11111111111111111111100011, 26],
  [0b11111111111111111111100100, 26],
  [0b111111111111111111111011110, 27],
  [0b111111111111111111111011111, 27],
  [0b11111111111111111111100101, 26],
  [0b111111111111111111110001, 24],
  [0b1111111111111111111101101, 25],
  [0b1111111111111110010, 19],
  [0b111111111111111100011, 21],
  [0b11111111111111111111100110, 26],
  [0b111111111111111111111100000, 27],
  [0b111111111111111111111100001, 27],
  [0b11111111111111111111100111, 26],
  [0b111111111111111111111100010, 27],
  [0b111111111111111111110010, 24],
  [0b111111111111111100100, 21],
  [0b111111111111111100101, 21],
  [0b11111111111111111111101000, 26],
  [0b11111111111111111111101001, 26],
  [0b1111111111111111111111111101, 28],
  [0b111111111111111111111100011, 27],
  [0b111111111111111111111100100, 27],
  [0b111111111111111111111100101, 27],
  [0b11111111111111101100, 20],
  [0b111111111111111111110011, 24],
  [0b11111111111111101101, 20],
  [0b111111111111111100110, 21],
  [0b1111111111111111101001, 22],
  [0b111111111111111100111, 21],
  [0b111111111111111101000, 21],
  [0b11111111111111111110011, 23],
  [0b1111111111111111101010, 22],
  [0b1111111111111111101011, 22],
  [0b1111111111111111111101110, 25],
  [0b1111111111111111111101111, 25],
  [0b111111111111111111110100, 24],
  [0b111111111111111111110101, 24],
  [0b11111111111111111111101010, 26],
  [0b11111111111111111110100, 23],
  [0b11111111111111111111101011, 26],
  [0b111111111111111111111100110, 27],
  [0b11111111111111111111101100, 26],
  [0b11111111111111111111101101, 26],
  [0b111111111111111111111100111, 27],
  [0b111111111111111111111101000, 27],
  [0b111111111111111111111101001, 27],
  [0b111111111111111111111101010, 27],
  [0b111111111111111111111101011, 27],
  [0b1111111111111111111111111110, 28],
  [0b111111111111111111111101100, 27],
  [0b111111111111111111111101101, 27],
  [0b111111111111111111111101110, 27],
  [0b111111111111111111111101111, 27],
  [0b111111111111111111111110000, 27],
  [0b11111111111111111111101110, 26],
  [0b111111111111111111111111111111, 30],  // EOS
];

export class H2Bytes extends Bytes {

  /**
   * Currently an extremely limited implementation that can only encode numbers within the 'prefix'
   * @param i 
   * @param leftBitCount 
   * @param leftBitValue 
   */
  writeH2Integer(i: number, leftBitCount = 0, leftBitValue = 0) {
    if (leftBitCount > 7) throw new Error('leftBitCount must be 7 or less');
    const prefixBitCount = 8 - leftBitCount;
    const maxInteger = (1 << prefixBitCount) - 1;
    if (i > maxInteger) throw new Error(`Integer must be ${maxInteger} or less`);
    let byte = leftBitValue << prefixBitCount;
    byte = byte | i;
    this.writeUint8(byte);
  }

  writeLengthH2Integer(leftBitCount = 0, leftBitValue = 0, comment?: string) {
    this.ensureWriteAvailable(1);
    const startOffset = this.offset;
    this.offset += 1;
    const endOffset = this.offset;
    this.changeIndent(1);
    return () => {
      const length = this.offset - endOffset;
      const currentOffset = this.offset;
      this.offset = startOffset;
      this.writeH2Integer(length, leftBitCount, leftBitValue);
      chatty && this.comment(this.lengthComment(length, comment));
      this.offset = currentOffset;
      this.changeIndent(-1);
    };
  }

  writeH2HuffmanString(s: string) {
    const raw = te.encode(s);
    let bitComment = chatty && '';
    const inlen = raw.byteLength;
    let outByte = 0, outBitIndex = 0;
    for (let i = 0; i < inlen; i++) {
      const ch = raw[i];
      let [encodedValue, remainingBitCount] = H[ch];
      if (chatty) bitComment += ` ${encodedValue.toString(2)}=` + (ch >= 33 && ch <= 126 ? String.fromCharCode(ch) : `0x${ch.toString(16).padStart(2, ' ')}`);
      while (remainingBitCount > 0) {
        if (outBitIndex === 8) {
          this.writeUint8(outByte);
          outByte = outBitIndex = 0;
        }
        const bitsLeftInByte = 8 - outBitIndex;
        const bitsToWrite = Math.min(bitsLeftInByte, remainingBitCount);
        const rightShiftBits = remainingBitCount - bitsLeftInByte;
        outByte = outByte | (rightShiftBits >= 0 ? encodedValue >>> rightShiftBits : encodedValue << -rightShiftBits);
        remainingBitCount -= bitsToWrite;
        encodedValue = encodedValue & ((1 << remainingBitCount) - 1);
        outBitIndex += bitsToWrite;
      }
    }
    if (outBitIndex > 0) {
      const bitsLeftInByte = 8 - outBitIndex;
      const padding = (1 << bitsLeftInByte) - 1;
      outByte = outByte | padding;
      this.writeUint8(outByte);
      bitComment += ` ${padding.toString(2)}=(padding)`;
    }
    chatty && this.comment(`"${s}":${bitComment}`);
  }

}