import cs from '../util/cryptoProxy';

export interface AesGcmArgs {
  data: Uint8Array;
  key: Uint8Array;
  iv: Uint8Array;
  xorValue: bigint;
  authTagByteLength: number;
  additionalData: Uint8Array;
};

/**
 * Encrypt or decrypt AES-GCM data for TLS/QUIC.
 * @param args.data plaintext for encrypt, concat(ciphertext, authTag) for decrypt
 * @returns plaintext for decrypt, concat(ciphertext, authTag) for encrypt
 */
export async function aesGcmWithXorIv(mode: 'encrypt' | 'decrypt', args: AesGcmArgs) {
  const { data, key: keyData, iv: originalIv, xorValue, authTagByteLength, additionalData } = args;

  const key = await cs.importKey('raw', keyData, { name: 'AES-GCM' }, false, [mode]);

  const iv = originalIv.slice();  // don't mess with original IV
  const ivLength = BigInt(iv.length);

  const lastIndex = ivLength - 1n;
  for (let i = 0n; i < ivLength; i++) {
    const shifted = xorValue >> (i << 3n);
    if (shifted === 0n) break;  // nothing more to be XORed
    iv[Number(lastIndex - i)] ^= Number(shifted & 0xffn);
  }

  const authTagBitLength = authTagByteLength << 3;  // byte count -> bit count
  const algorithm = { name: 'AES-GCM', iv, tagLength: authTagBitLength, additionalData };
  const resultBuffer = await cs[mode](algorithm, key, data);
  const result = new Uint8Array(resultBuffer);
  return result;
}

export class Crypter {
  recordsProcessed = 0n;
  priorPromise: Promise<any> = Promise.resolve(new Uint8Array());

  constructor(
    private mode: 'encrypt' | 'decrypt',
    private key: Uint8Array,
    private initialIv: Uint8Array,
  ) { }

  // The `Promise`s returned by successive calls to this function always resolve in sequence,
  // which is not true for `processUnsequenced` in Node (even if it seems to be in browsers)
  async process(data: Uint8Array, authTagLength: number, additionalData: Uint8Array) {
    return this.sequence(this.processUnsequenced(data, authTagLength, additionalData));
  }

  async sequence<T>(promise: Promise<T>) {
    const sequenced = this.priorPromise.then(() => promise);
    this.priorPromise = sequenced;
    return sequenced;
  }

  /**
   * Encrypt or decrypt AES-GCM data for TLS/QUIC.
   * @param data plaintext for encrypt, concat(ciphertext, authTag) for decrypt
   * @param authTagByteLength 
   * @param additionalData 
   * @param xorValue used when decrypting QUIC packets, which may arrive out of order, and must be set to the packet number
   * @returns plaintext for decrypt, concat(ciphertext, authTag) for encrypt
   */
  async processUnsequenced(data: Uint8Array, authTagByteLength: number, additionalData: Uint8Array) {
    const recordIndex = this.recordsProcessed;
    this.recordsProcessed += 1n;

    return aesGcmWithXorIv(this.mode, {
      data,
      key: this.key,
      iv: this.initialIv,
      xorValue: recordIndex,
      additionalData,
      authTagByteLength,
    });
  }
}
