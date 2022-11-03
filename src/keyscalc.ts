
function u8FromHex(hex: string) {
  return new Uint8Array(Array.from(hex.matchAll(/../g)).map(hex => parseInt(hex[0], 16)));
}

function hexFromU8(u8: Uint8Array) {
  return [...u8].map(n => n.toString(16).padStart(2, '0')).join('');
}

const textEncoder = new TextEncoder();
const tls13_Bytes = textEncoder.encode('tls13 ');

async function hkdfExtract(salt: Uint8Array, keyMaterial: Uint8Array, hashBits: 256 | 384) {
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

  const hmacKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: { name: `SHA-${hashBits}` } }, false, ['sign']);
  var prk = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, keyMaterial));  // yes, the key material is used as the input data, not the key
  return prk;
}

async function hkdfExpand(key: Uint8Array, info: Uint8Array, length: number, hashBits: 256 | 384) {
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

  const okm = new Uint8Array(length);
  const hmacKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: { name: `SHA-${hashBits}` } }, false, ['sign']);
  const infoLen = info.length;

  const hashBytes = hashBits >> 3;
  const n = Math.ceil(length / hashBytes);

  let prevT = new Uint8Array(0);
  for (let i = 1; i <= n; i++) {
    const prevTLen = prevT.length;
    const hmacData = new Uint8Array(prevTLen + infoLen + 1);
    hmacData.set(prevT);
    hmacData.set(info, prevTLen);
    hmacData[prevTLen + infoLen] = i;
    const tiBuffer = await crypto.subtle.sign('HMAC', hmacKey, hmacData);
    const ti = new Uint8Array(tiBuffer);
    okm.set(ti, hashBytes * (i - 1));
    prevT = ti;
  }

  return okm.subarray(0, length);
}

async function hkdfExpandLabel(key: Uint8Array, label: Uint8Array, context: Uint8Array, length: number, hashBits: 256 | 384) {
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

  const labelLength = label.length;
  const contextLength = context.length;

  const hkdfLabel = new Uint8Array(2 + 1 + 6 + labelLength + 1 + contextLength);

  // desired length, split into high and low bytes
  hkdfLabel[0] = (length & 0xff00) >> 8;
  hkdfLabel[1] = length & 0xff;

  // label length, including "tls13 " prefix
  hkdfLabel[2] = labelLength + 6;
  // label, including "tls13 " prefix
  hkdfLabel.set(tls13_Bytes, 2 + 1);
  hkdfLabel.set(label, 2 + 1 + 6);

  // context length
  hkdfLabel[2 + 1 + 6 + labelLength] = contextLength;
  // context
  hkdfLabel.set(context, 2 + 1 + 6 + labelLength + 1);

  return hkdfExpand(key, hkdfLabel, length, hashBits);
}

export async function calculateKeysTest() {
  // https://tls13.xargs.org/#server-handshake-keys-calc
  // $ hello_hash = e05f64fcd082bdb0dce473adf669c2769f257a1c75a51b7887468b5e0e7a7de4f4d34555112077f16e079019d5a845bd
  // $ shared_secret = df4a291baa1eb7cfa6934b29b474baad2697e29f1f920dcc77c8a0a088447624
  const helloHash = u8FromHex('e05f64fcd082bdb0dce473adf669c2769f257a1c75a51b7887468b5e0e7a7de4f4d34555112077f16e079019d5a845bd');
  const sharedSecret = u8FromHex('df4a291baa1eb7cfa6934b29b474baad2697e29f1f920dcc77c8a0a088447624');
  return calculateKeys(sharedSecret, helloHash, 384);
}

export async function calculateKeys(sharedSecret: Uint8Array, helloHash: Uint8Array, hashBits: 256 | 384) {
  const hashBytes = hashBits >> 3;
  // $ zero_key = 000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
  const zeroKey = new Uint8Array(hashBytes);

  // $ early_secret = $(./hkdf-384 extract 00 $zero_key)
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashBits);
  console.log('early secret', hexFromU8(new Uint8Array(earlySecret)));

  // $ empty_hash = $(openssl sha384 < /dev/null | sed - e 's/.* //')
  const emptyHashBuffer = await crypto.subtle.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  console.log('empty hash', hexFromU8(emptyHash));

  // $ derived_secret = $(./hkdf-384 expandlabel $early_secret "derived" $empty_hash 48)
  const derivedSecret = await hkdfExpandLabel(earlySecret, textEncoder.encode('derived'), emptyHash, hashBytes, hashBits);
  console.log('derived secret', hexFromU8(derivedSecret));
  /*
  
  $ handshake_secret = $(./hkdf-384 extract $derived_secret $shared_secret)
  $ csecret = $(./hkdf-384 expandlabel $handshake_secret "c hs traffic" $hello_hash 48)
  $ ssecret = $(./hkdf-384 expandlabel $handshake_secret "s hs traffic" $hello_hash 48)
  $ client_handshake_key = $(./hkdf-384 expandlabel $csecret "key" "" 32)
  $ server_handshake_key = $(./hkdf-384 expandlabel $ssecret "key" "" 32)
  $ client_handshake_iv = $(./hkdf-384 expandlabel $csecret "iv" "" 12)
  $ server_handshake_iv = $(./hkdf-384 expandlabel $ssecret "iv" "" 12)
  $ echo hssec: $handshake_secret
  $ echo ssec: $ssecret
  $ echo csec: $csecret
  $ echo skey: $server_handshake_key
  $ echo siv: $server_handshake_iv
  $ echo ckey: $client_handshake_key
  $ echo civ: $client_handshake_iv
  
  hssec: bdbbe8757494bef20de932598294ea65b5e6bf6dc5c02a960a2de2eaa9b07c929078d2caa0936231c38d1725f179d299
  ssec: 23323da031634b241dd37d61032b62a4f450584d1f7f47983ba2f7cc0cdcc39a68f481f2b019f9403a3051908a5d1622
  csec: db89d2d6df0e84fed74a2288f8fd4d0959f790ff23946cdf4c26d85e51bebd42ae184501972f8d30c4a3e4a3693d0ef0
  skey: 9f13575ce3f8cfc1df64a77ceaffe89700b492ad31b4fab01c4792be1b266b7f
  siv: 9563bc8b590f671f488d2da3
  ckey: 1135b4826a9a70257e5a391ad93093dfd7c4214812f493b3e3daae1eb2b1ac69
  civ: 4256d2e0e88babdd05eb2f27
  */

}