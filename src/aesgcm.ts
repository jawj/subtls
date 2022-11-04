export class Decrypter {
  key: CryptoKey;
  iv: any;
  ivDataView: DataView;
  recordsDecrypted = 0;

  constructor(key: CryptoKey, initialIv: Uint8Array) {
    this.key = key;
    this.iv = initialIv;
    this.ivDataView = new DataView(this.iv.buffer, this.iv.byteOffset, this.iv.byteLength);
  }

  async decrypt(cipherTextPlusAuthTag: Uint8Array, authTagLength: number, additionalData: Uint8Array) {
    const ivLength = this.iv.length;
    const authTagBits = authTagLength << 3;

    let ivLast32 = this.ivDataView.getUint32(ivLength - 4);
    ivLast32 ^= this.recordsDecrypted;
    this.ivDataView.setUint32(ivLength - 4, ivLast32);
    this.recordsDecrypted += 1;

    const algorithm = { name: 'AES-GCM', iv: this.iv, tagLength: authTagBits, additionalData };

    const plainTextBuffer = await crypto.subtle.decrypt(algorithm, this.key, cipherTextPlusAuthTag);
    const plainText = new Uint8Array(plainTextBuffer);
    return plainText;
  }
}