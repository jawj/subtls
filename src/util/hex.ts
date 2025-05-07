import { toHex } from 'hextreme';

export function u8FromHex(hex: string) {
  return new Uint8Array(Array.from(hex.matchAll(/[0-9a-f]{2}/g)).map(hex => parseInt(hex[0], 16)));
}

export function hexFromU8(u8: Uint8Array | number[], spacer = '') {
  if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
  if (spacer === '') return toHex(u8);
  if (spacer === ' ') return toHexSpaced(u8);
  throw new Error('Spacer may only be empty or a single space');
}

// fast spaced hex encoding

const te = new TextEncoder();
const td = new TextDecoder();
const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const hexChars = te.encode('0123456789abcdef');
const ccEvens = new Uint16Array(256);
const ccOdds = new Uint32Array(256);

if (littleEndian) for (let i = 0; i < 256; i++) {
  ccEvens[i] = hexChars[i & 0xF] << 8 | hexChars[i >>> 4];
  ccOdds[i] = 32 << 16 | hexChars[i >>> 4] << 24 | hexChars[i & 0xF] | 32 << 8;
}
else for (let i = 0; i < 256; i++) {
  ccEvens[i] = hexChars[i & 0xF] | hexChars[i >>> 4] << 8;
  ccOdds[i] = 32 << 24 | hexChars[i >>> 4] << 16 | hexChars[i & 0xF] << 8 | 32;
}

export function toHexSpaced(in8: Uint8Array) {
  const bytes = in8.length;
  const out16 = new Uint16Array((bytes * 1.5) << 0);
  let outIndex = 0;
  for (let i = 0; i < bytes; i += 2) {
    out16[outIndex++] = ccEvens[in8[i]];
    const ccOdd = ccOdds[in8[i + 1]];
    out16[outIndex++] = ccOdd >>> 16;
    out16[outIndex++] = ccOdd & 0xffff;
  }
  const out8 = new Uint8Array(out16.buffer);
  return td.decode(out8.subarray(0, bytes * 3 - 1));
}
