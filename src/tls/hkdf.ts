import { concat } from '../util/array';
import cs from '../util/cryptoProxy';

const txtEnc = new TextEncoder();

export async function hkdfExtract(salt: Uint8Array, keyMaterial: Uint8Array, hashBits: 256 | 384) {
  /*
  from https://www.ietf.org/rfc/rfc5869.txt:
 
  HKDF-Extract(salt, IKM) -> PRK
 
  Options:
    Hash     a hash function; HashLen denotes the length of the
              hash function output in octets
 
  Inputs:
    salt     optional salt value (a non-secret random value);
              if not provided, it is set to a string of HashLen zeros.
    IKM      input keying material
 
  Output:
    PRK      a pseudorandom key (of HashLen octets)
 
  The output PRK is calculated as follows:
 
  PRK = HMAC-Hash(salt, IKM)
  */
  const hmacKey = await cs.importKey('raw', salt, { name: 'HMAC', hash: { name: `SHA-${hashBits}` } }, false, ['sign']);
  const prk = new Uint8Array(await cs.sign('HMAC', hmacKey, keyMaterial)); // yes, the key material is used as the input data, not the key
  return prk;
}

export async function hkdfExpand(key: Uint8Array, info: Uint8Array, length: number, hashBits: 256 | 384) {
  /*
  from https://www.ietf.org/rfc/rfc5869.txt:
 
  HKDF-Expand(PRK, info, L) -> OKM
 
  Options:
    Hash     a hash function; HashLen denotes the length of the
              hash function output in octets
 
  Inputs:
    PRK      a pseudorandom key of at least HashLen octets
              (usually, the output from the extract step)
    info     optional context and application specific information
              (can be a zero-length string)
    L        length of output keying material in octets
              (<= 255*HashLen)
 
  Output:
    OKM      output keying material (of L octets)
 
  The output OKM is calculated as follows:
 
  N = ceil(L/HashLen)
  T = T(1) | T(2) | T(3) | ... | T(N)
  OKM = first L octets of T
 
  where:
  T(0) = empty string (zero length)
  T(1) = HMAC-Hash(PRK, T(0) | info | 0x01)
  T(2) = HMAC-Hash(PRK, T(1) | info | 0x02)
  T(3) = HMAC-Hash(PRK, T(2) | info | 0x03)
  ...
 
  (where the constant concatenated to the end of each T(n) is a
  single octet.)
  */
  const hashBytes = hashBits >> 3;
  const n = Math.ceil(length / hashBytes);

  const okm = new Uint8Array(n * hashBytes);
  const hmacKey = await cs.importKey('raw', key, { name: 'HMAC', hash: { name: `SHA-${hashBits}` } }, false, ['sign']);

  let tPrev = new Uint8Array(0);
  for (let i = 0; i < n; i++) {
    const hmacData = concat(tPrev, info, [i + 1]);
    const tiBuffer = await cs.sign('HMAC', hmacKey, hmacData);
    const ti = new Uint8Array(tiBuffer);
    okm.set(ti, hashBytes * i);
    tPrev = ti;
  }

  return okm.subarray(0, length);
}
const tls13_Bytes = txtEnc.encode('tls13 ');

export async function hkdfExpandLabel(key: Uint8Array, label: string, context: Uint8Array, length: number, hashBits: 256 | 384) {
  /*
  from https://www.rfc-editor.org/rfc/rfc8446#section-7.1:
 
  HKDF-Expand-Label(Secret, Label, Context, Length) =
          HKDF-Expand(Secret, HkdfLabel, Length)
 
      Where HkdfLabel is specified as:
 
      struct {
          uint16 length = Length;
          opaque label<7..255> = "tls13 " + Label;
          opaque context<0..255> = Context;
      } HkdfLabel;
  */
  const labelData = txtEnc.encode(label);
  const hkdfLabel = concat(
    [(length & 0xff00) >> 8, length & 0xff],
    [tls13_Bytes.length + labelData.length], tls13_Bytes, labelData,
    [context.length], context
  );
  return hkdfExpand(key, hkdfLabel, length, hashBits);
}
