import cs from '../util/cryptoProxy';

const maxRecords = 1 << 30;  // because signed integers 1^31 is max recordsDecrypted value

export class Crypter {
  mode: 'encrypt' | 'decrypt';
  key: CryptoKey;
  initialIv: Uint8Array;
  ivLength: number;
  currentIv: Uint8Array;
  currentIvDataView: DataView;
  initialIvLast32: number;
  recordsDecrypted = 0;

  constructor(mode: 'encrypt' | 'decrypt', key: CryptoKey, initialIv: Uint8Array) {
    this.mode = mode;
    this.key = key;
    this.initialIv = initialIv;
    this.ivLength = initialIv.length;
    this.currentIv = initialIv.slice();
    this.currentIvDataView = new DataView(this.currentIv.buffer, this.currentIv.byteOffset, this.currentIv.byteLength);
    this.initialIvLast32 = this.currentIvDataView.getUint32(this.ivLength - 4);
  }

  // data is plainText for encrypt, concat(ciphertext, authTag) for decrypt
  async process(data: Uint8Array, authTagLength: number, additionalData: Uint8Array) {
    if (this.recordsDecrypted === maxRecords) throw new Error('Cannot encrypt/decrypt any more records');
    const currentIvLast32 = this.initialIvLast32 ^ this.recordsDecrypted;
    this.currentIvDataView.setUint32(this.ivLength - 4, currentIvLast32);
    this.recordsDecrypted += 1;

    const authTagBits = authTagLength << 3;
    const algorithm = { name: 'AES-GCM', iv: this.currentIv, tagLength: authTagBits, additionalData };
    const resultBuffer = await cs[this.mode](algorithm, this.key, data);

    const result = new Uint8Array(resultBuffer);
    return result;
  }
}
