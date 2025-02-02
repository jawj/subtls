import { Bytes } from './bytes';

const te = new TextEncoder();
const td = new TextDecoder();
const HuffmanCodes = [
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

export function makeHuffmanTree5() {
  const tree: any = new Array(32);
  for (let ch = 0; ch < 256; ch++) {
    const [code, bits] = HuffmanCodes[ch];
    const firstShift = bits - 5;
    let i = firstShift, node = tree;
    do {
      let branch = code >> i;
      if (i < firstShift) branch &= 0x01;
      if (i === 0) node[branch] = ch;
      else node = node[branch] ??= [];
    } while (i--);
  }
  console.log(JSON.stringify(tree));
}

const HuffmanTree = [48, 49, 50, 97, 99, 101, 105, 111, 115, 116, [32, 37], [45, 46], [47, 51], [52, 53], [54, 55], [56, 57], [61, 65], [95, 98], [100, 102], [103, 104], [108, 109], [110, 112], [114, 117], [[58, 66], [67, 68]], [[69, 70], [71, 72]], [[73, 74], [75, 76]], [[77, 78], [79, 80]], [[81, 82], [83, 84]], [[85, 86], [87, 89]], [[106, 107], [113, 118]], [[119, 120], [121, 122]], [[[38, 42], [44, 59]], [[88, 90], [[[33, 34], [40, 41]], [[63, [39, 43]], [[124, [35, 62]], [[[0, 36], [64, 91]], [[93, 126], [[94, 125], [[60, 96], [123, [[[[92, 195], [208, [128, 130]]], [[[131, 162], [184, 194]], [[224, 226], [[153, 161], [167, 172]]]]], [[[[[176, 177], [179, 209]], [[216, 217], [227, 229]]], [[[230, [129, 132]], [[133, 134], [136, 146]]], [[[154, 156], [160, 163]], [[164, 169], [170, 173]]]]], [[[[[178, 181], [185, 186]], [[187, 189], [190, 196]]], [[[198, 228], [232, 233]], [[[1, 135], [137, 138]], [[139, 140], [141, 143]]]]], [[[[[147, 149], [150, 151]], [[152, 155], [157, 158]]], [[[165, 166], [168, 174]], [[175, 180], [182, 183]]]], [[[[188, 191], [197, 231]], [[239, [9, 142]], [[144, 145], [148, 159]]]], [[[[171, 206], [215, 225]], [[236, 237], [[199, 207], [234, 235]]]], [[[[[192, 193], [200, 201]], [[202, 205], [210, 213]]], [[[218, 219], [238, 240]], [[242, 243], [255, [203, 204]]]]], [[[[[211, 212], [214, 221]], [[222, 223], [241, 244]]], [[[245, 246], [247, 248]], [[250, 251], [252, 253]]]], [[[[254, [2, 3]], [[4, 5], [6, 7]]], [[[8, 11], [12, 14]], [[15, 16], [17, 18]]]], [[[[19, 20], [21, 23]], [[24, 25], [26, 27]]], [[[28, 29], [30, 31]], [[127, 220], [249, [[10, 13], [22]]]]]]]]]]]]]]]]]]]]]]]]]];

export class HPACKBytes extends Bytes {

  writeHPACKInt(i: number, leftBitCount = 0, leftBitValue = 0, suppressComment = false) {
    if (leftBitCount > 7) throw new Error('leftBitCount must be 7 or less');
    const iOriginal = i;
    const prefixBitCount = 8 - leftBitCount;
    const continuationValue = (1 << prefixBitCount) - 1;
    if (i < continuationValue) {  // value fits in 'prefix'
      this.writeUint8((leftBitValue << prefixBitCount) | i);
    } else {
      this.writeUint8((leftBitValue << prefixBitCount) | continuationValue);
      i -= continuationValue;
      while (i >= 0x80) {
        this.writeUint8((i & 0x7f) | 0x80); // least significant bits + continuation bit
        i = i >> 7;
      }
      this.writeUint8(i);
    }
    chatty && !suppressComment && this.comment(`flag bit${leftBitCount === 1 ? '' : 's'} (${leftBitValue.toString(2).padStart(leftBitCount, '0')}), integer (${iOriginal})`);
  }

  async readHPACKInt(leftBitCount = 0, suppressComment = false) {
    const firstByte = await this.readUint8();
    const prefixBitCount = 8 - leftBitCount;
    const leftBitValue = firstByte >>> prefixBitCount;
    const continuationValue = (1 << prefixBitCount) - 1;
    let i = firstByte & continuationValue;
    if (i === continuationValue) {
      let byte, leftShift = 0;
      do {
        byte = await this.readUint8();
        i += (byte & 0x7f) << leftShift;  // note: NOT i = i | ...
        leftShift += 7;
      } while (byte & 0x80);
    }
    chatty && !suppressComment && this.comment(`flag bit${leftBitCount === 1 ? '' : 's'} (${leftBitValue.toString(2).padStart(leftBitCount, '0')}), integer (${i})`);
    return { leftBitValue, i };
  }

  writeHPACKString(s: string) {
    const inBytes = te.encode(s);
    const inBytesLength = inBytes.byteLength;
    const outBytes = new Uint8Array(inBytesLength);  // if it gets this long, we write the octets instead

    let outByte = 0, outByteIndex = 0, outBitIndex = 0;
    let bitComment = chatty && '';

    huffman: {
      for (let i = 0; i < inBytesLength; i++) {
        const ch = inBytes[i];
        let [encodedValue, remainingBitCount] = HuffmanCodes[ch];
        if (chatty) bitComment += ` ${encodedValue.toString(2)}=` + (ch >= 33 && ch <= 126 ? String.fromCharCode(ch) : `0x${ch.toString(16).padStart(2, ' ')}`);
        while (remainingBitCount > 0) {
          if (outBitIndex === 8) {
            outBytes[outByteIndex++] = outByte;
            if (outByteIndex === inBytesLength) break huffman;
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
        const padding = (1 << bitsLeftInByte) - 1; // we could & this with H[256][0], but since that's all 1s there's little point
        outByte = outByte | padding;
        outBytes[outByteIndex++] = outByte;
        bitComment += ` ${padding.toString(2)}=(padding)`;
      }
    }

    if (outByteIndex < inBytesLength) {
      this.writeHPACKInt(outByteIndex, 1, 1);
      chatty && this.comment(`= [Huffman-encoded string](https://datatracker.ietf.org/doc/html/rfc7541#appendix-B), ${outByteIndex} byte${outByteIndex === 1 ? '' : 's'}`);
      chatty && this.changeIndent(1);
      this.writeBytes(outBytes.subarray(0, outByteIndex));
      chatty && this.comment(`"${s}":${bitComment}`);
      chatty && this.changeIndent(-1);

    } else {
      this.writeHPACKInt(inBytesLength, 1, 0);
      chatty && this.comment(`= raw octet string, ${inBytesLength} byte${inBytesLength === 1 ? '' : 's'}`);
      chatty && this.changeIndent(1);
      this.writeBytes(inBytes);
      chatty && this.comment(`"${s}"`);
      chatty && this.changeIndent(-1);
    }
  }

  async readHPACKString() {
    const { leftBitValue: huffman, i: length } = await this.readHPACKInt(1);
    chatty && this.comment(`= ${huffman ? 'Huffman-encoded string' : 'raw octet string'}, ${length} byte${length === 1 ? '' : 's'}`);
    chatty && this.changeIndent(1);

    if (!huffman) {
      const str = await this.readUTF8String(length);
      chatty && this.changeIndent(-1);
      return str;
    }

    const inBytes = await this.readBytes(length);
    const outBytes = new Uint8Array(length << 1);  // smallest codes are 5 bits, so decoded length can't be more than 2x encoded

    let inByteIndex = 0, inBitIndex = 0, outByteIndex = 0, inByte;
    let node: any, branch: number;

    outer: while (true) {
      node = HuffmanTree;

      inByte = inBytes[inByteIndex];
      let inWord = inByte << 8;
      if (inBitIndex > 3) inWord |= inBytes[inByteIndex + 1];
      const rightShift = 11 - inBitIndex;
      branch = (inWord >>> rightShift) & 0x1f;

      inBitIndex += 5;
      if (inBitIndex > 7) {
        inBitIndex -= 8;
        inByteIndex++;
        if (inByteIndex === length) break outer;
        inByte = inBytes[inByteIndex];
      }

      while (true) {
        node = node[branch];
        if (typeof node === 'number') {
          outBytes[outByteIndex++] = node;
          break;
        };

        branch = (inByte >> (7 - inBitIndex)) & 0x01;

        inBitIndex++;
        if (inBitIndex > 7) {
          inBitIndex -= 8;
          inByteIndex++;
          if (inByteIndex === length) break outer;
          inByte = inBytes[inByteIndex];
        }
      };
    }

    // TODO: check there's no more than 7 bits of padding, and that it's all 1s

    const str = td.decode(outBytes.subarray(0, outByteIndex));
    chatty && this.comment(`"${str}"`);
    chatty && this.changeIndent(-1);
    return str;
  }

}
