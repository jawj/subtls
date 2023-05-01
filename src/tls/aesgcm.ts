import cs from '../util/cryptoProxy';
// import { log } from '../presentation/log';

const maxRecords = (2 ** 31) - 1;  // because JS bit-twiddling is done on signed Int32

export class Crypter {
  recordsProcessed = 0;
  prevPromise: Promise<any> = Promise.resolve();

  constructor(
    private mode: 'encrypt' | 'decrypt',
    private key: CryptoKey,
    private initialIv: Uint8Array
  ) { }

  // data is plainText for encrypt, concat(ciphertext, authTag) for decrypt
  async process(data: Uint8Array, authTagLength: number, additionalData: Uint8Array) {
    const record = this.recordsProcessed;
    if (record === maxRecords) throw new Error('Cannot encrypt/decrypt any more records');
    this.recordsProcessed += 1;

    const iv = this.initialIv.slice();
    const ivLength = iv.length;
    iv[ivLength - 1] ^= record /* */ & 0xff;
    iv[ivLength - 2] ^= record >>> 8 & 0xff;
    iv[ivLength - 3] ^= record >>> 16 & 0xff;
    iv[ivLength - 4] ^= record >>> 24 & 0xff;

    // chatty && log(`records ${this.mode}ed:`, this.recordsCrypted);

    const tagLength = authTagLength << 3;  // bytes -> bits
    const algorithm = { name: 'AES-GCM', iv, tagLength, additionalData };

    // chatty && log(`${this.mode} iv`, iv.join(' '));
    // chatty && log(`${this.mode} input`, { algorithm, key: await cs.exportKey('jwk', this.key), data });

    process.stdout.write('i' + this.mode.charAt(0) + record + '.');
    const resultPromise = cs[this.mode](algorithm, this.key, data);

    const { prevPromise } = this;
    this.prevPromise = resultPromise;

    const [resultBuffer] = await Promise.all([resultPromise, prevPromise]);  // ensure the Promises we return always resolve in call order
    const result = new Uint8Array(resultBuffer);
    process.stdout.write('o' + this.mode.charAt(0) + record + '.');
    // chatty && log(`${this.mode} output`, result);

    return result;
  }
}
