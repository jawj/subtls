
export function concat(...arrs: (Uint8Array | number[])[]) {
  length = arrs.reduce((memo, arr) => memo + arr.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const arr of arrs) {
    result.set(arr, offset);
    offset += arr.length
  }
  return result;
}