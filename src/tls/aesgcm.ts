import cs from '../util/cryptoProxy';
// import { log } from '../presentation/log';

const maxRecords = (2 ** 31) - 1;  // because JS bit-twiddling is done on signed Int32

export class Crypter {
  mode: 'encrypt' | 'decrypt';
  key: CryptoKey;
  initialIv: Uint8Array;
  recordsCrypted = 0;

  constructor(mode: 'encrypt' | 'decrypt', key: CryptoKey, initialIv: Uint8Array) {
    this.mode = mode;
    this.key = key;
    this.initialIv = initialIv;
  }

  // data is plainText for encrypt, concat(ciphertext, authTag) for decrypt
  async process(data: Uint8Array, authTagLength: number, additionalData: Uint8Array) {
    if (this.recordsCrypted === maxRecords) throw new Error('Cannot encrypt/decrypt any more records');

    const iv = this.initialIv.slice();
    const { length } = iv;
    const { recordsCrypted } = this;
    iv[length - 1] ^= recordsCrypted /* */ & 0xff;
    iv[length - 2] ^= recordsCrypted >>> 8 & 0xff;
    iv[length - 3] ^= recordsCrypted >>> 16 & 0xff;
    iv[length - 4] ^= recordsCrypted >>> 24 & 0xff;

    this.recordsCrypted += 1;

    // chatty && log(`records ${this.mode}ed:`, this.recordsCrypted);

    const tagLength = authTagLength << 3;  // bytes -> bits
    const algorithm = { name: 'AES-GCM', iv, tagLength, additionalData };

    // chatty && log(`${this.mode} iv`, iv.join(' '));
    // chatty && log(`${this.mode} input`, { algorithm, key: await cs.exportKey('jwk', this.key), data });

    const resultBuffer = await cs[this.mode](algorithm, this.key, data);
    const result = new Uint8Array(resultBuffer);

    // chatty && log(`${this.mode} output`, result);

    return result;
  }
}
