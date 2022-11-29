
const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export function uint8FromUint32(uint32Array: Uint32Array) {
  return littleEndian ?
    new Uint8Array(uint32Array.reverse().buffer).reverse() :
    new Uint8Array(uint32Array.buffer);
}
