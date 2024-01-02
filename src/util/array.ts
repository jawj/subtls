export function concat(...arrs: (Uint8Array | number[])[]) {
  if (arrs.length === 1 && arrs[0] instanceof Uint8Array) return arrs[0];

  const length = arrs.reduce((memo, arr) => memo + arr.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const arr of arrs) {
    result.set(arr, offset);
    offset += arr.length
  }
  return result;
}

export function equal(a: Uint8Array | number[], b: Uint8Array | number[]) {
  const aLength = a.length;
  if (aLength !== b.length) return false;
  for (let i = 0; i < aLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function range(start: number, stop?: number, step?: number) {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }
  if (step === undefined) step = 1;
  const result = [];
  for (let i = start; i < stop; i += step) result.push(i)
  return result;
}

export class GrowableData {
  private length: number;
  private data: Uint8Array;

  constructor() {
    this.length = 0;
    this.data = new Uint8Array();
  }

  append(newData: Uint8Array) {
    const newDataLength = newData.length;
    if (this.length + newDataLength > this.data.length) {
      const prevData = this.data;
      this.data = new Uint8Array(this.length * 2 + newDataLength);
      this.data.set(prevData);
    }

    this.data.set(newData, this.length);
    this.length += newData.length;
  }

  getData() {
    return this.data.subarray(0, this.length);
  }
}