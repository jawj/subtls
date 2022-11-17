export class Crypter {
  mode: 'encrypt' | 'decrypt';
  key: CryptoKey;
  iv: any;
  ivDataView: DataView;
  recordsDecrypted = 0;

  constructor(mode: 'encrypt' | 'decrypt', key: CryptoKey, initialIv: Uint8Array) {
    this.mode = mode;
    this.key = key;
    this.iv = initialIv;
    this.ivDataView = new DataView(this.iv.buffer, this.iv.byteOffset, this.iv.byteLength);
  }

  // data is plainText for encrypt, concat(ciphertext, authTag) for decrypt
  async process(data: Uint8Array, authTagLength: number, additionalData: Uint8Array) {
    const ivLength = this.iv.length;
    const authTagBits = authTagLength << 3;

    let ivLast32 = this.ivDataView.getUint32(ivLength - 4);
    ivLast32 ^= this.recordsDecrypted;
    this.ivDataView.setUint32(ivLength - 4, ivLast32);
    this.recordsDecrypted += 1;

    const algorithm = { name: 'AES-GCM', iv: this.iv, tagLength: authTagBits, additionalData };

    const resultBuffer = await crypto.subtle[this.mode](algorithm, this.key, data);
    const result = new Uint8Array(resultBuffer);
    return result;
  }
}