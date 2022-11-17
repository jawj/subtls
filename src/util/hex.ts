
export function u8FromHex(hex: string) {
  return new Uint8Array(Array.from(hex.matchAll(/../g)).map(hex => parseInt(hex[0], 16)));
}

export function hexFromU8(u8: Uint8Array | number[]) {
  return [...u8].map(n => n.toString(16).padStart(2, '0')).join('');
}