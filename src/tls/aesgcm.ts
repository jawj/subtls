import cs from '../util/cryptoProxy';

const maxRecords = (2 ** 31) - 1;  // because JS bit-twiddling is done on signed Int32

export class Crypter {
  recordsProcessed = 0;
  priorPromise = Promise.resolve(new Uint8Array());

  constructor(
    private mode: 'encrypt' | 'decrypt',
    private key: CryptoKey,
    private initialIv: Uint8Array
  ) { }

  // The `Promise`s returned by successive calls to this function always resolve in sequence,
  // which is not true for `processUnsequenced` in Node (even if it seems to be in browsers)
  async process(data: Uint8Array, authTagLength: number, additionalData: Uint8Array) {
    const newPromise = this.processUnsequenced(data, authTagLength, additionalData);
    return this.priorPromise = this.priorPromise.then(() => newPromise);
  }

  // data is plainText for encrypt, concat(ciphertext, authTag) for decrypt
  async processUnsequenced(data: Uint8Array, authTagLength: number, additionalData: Uint8Array) {
    const record = this.recordsProcessed;
    if (record === maxRecords) throw new Error('Cannot encrypt/decrypt any more records');
    this.recordsProcessed += 1;

    const iv = this.initialIv.slice();
    const ivLength = iv.length;
    iv[ivLength - 1] ^= record /* */ & 0xff;
    iv[ivLength - 2] ^= record >>> 8 & 0xff;
    iv[ivLength - 3] ^= record >>> 16 & 0xff;
    iv[ivLength - 4] ^= record >>> 24 & 0xff;

    const tagLength = authTagLength << 3;  // byte count -> bit count
    const algorithm = { name: 'AES-GCM', iv, tagLength, additionalData };
    const resultBuffer = await cs[this.mode](algorithm, this.key, data);
    const result = new Uint8Array(resultBuffer);
    return result;
  }
}
