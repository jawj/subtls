
function u8FromHex(hex: string) {
  return new Uint8Array(Array.from(hex.matchAll(/../g)).map(hex => parseInt(hex[0], 16)));
}

function hexFromU8(u8: Uint8Array) {
  return [...u8].map(n => n.toString(16).padStart(2, '0')).join('');
}

async function hkdfExtract(salt: Uint8Array, keyMaterial: Uint8Array, hashLength: 256 | 384) {
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
  const hmacKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: { name: `SHA-${hashLength}` } }, false, ['sign']);
  var prk = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, keyMaterial));  // yes, the key material is used as the input data, not the key
  return prk;
}

async function hkdfExpand() {

}

async function hkdfExpandLabel(prk: Uint8Array, label: Uint8Array, context: Uint8Array, length: number) {

}

export async function calculateKeysTest() {
  // https://tls13.xargs.org/#server-handshake-keys-calc
  // $ hello_hash = e05f64fcd082bdb0dce473adf669c2769f257a1c75a51b7887468b5e0e7a7de4f4d34555112077f16e079019d5a845bd
  // $ shared_secret = df4a291baa1eb7cfa6934b29b474baad2697e29f1f920dcc77c8a0a088447624
  const helloHash = u8FromHex('e05f64fcd082bdb0dce473adf669c2769f257a1c75a51b7887468b5e0e7a7de4f4d34555112077f16e079019d5a845bd');
  const sharedSecret = u8FromHex('df4a291baa1eb7cfa6934b29b474baad2697e29f1f920dcc77c8a0a088447624');
  return calculateKeys(sharedSecret, helloHash, 384);
}

export async function calculateKeys(sharedSecret: Uint8Array, helloHash: Uint8Array, hashLength: 256 | 384) {
  // $ zero_key = 000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
  const zeroKey = new Uint8Array(hashLength >> 3);
  // $ early_secret = $(./hkdf-384 extract 00 $zero_key)
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashLength);
  console.log('early secret', hexFromU8(new Uint8Array(earlySecret)));
  // $ empty_hash = $(openssl sha384 < /dev/null | sed - e 's/.* //')
  const emptyHash = await crypto.subtle.digest(`SHA-${hashLength}`, new Uint8Array(0));
  console.log('empty hash', hexFromU8(new Uint8Array(emptyHash)));
  /*
  $ derived_secret = $(./hkdf-384 expandlabel $early_secret "derived" $empty_hash 48)
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