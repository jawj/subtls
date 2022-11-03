// src/util/tlsrecord.ts
var maxRecordLength = 1 << 14;

// src/keyscalc.ts
function u8FromHex(hex) {
  return new Uint8Array(Array.from(hex.matchAll(/../g)).map((hex2) => parseInt(hex2[0], 16)));
}
function hexFromU8(u8) {
  return [...u8].map((n) => n.toString(16).padStart(2, "0")).join("");
}
async function hkdfExtract(salt, keyMaterial, hashLength) {
  const hmacKey = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: { name: `SHA-${hashLength}` } }, false, ["sign"]);
  var prk = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, keyMaterial));
  return prk;
}
async function calculateKeysTest() {
  const helloHash = u8FromHex("e05f64fcd082bdb0dce473adf669c2769f257a1c75a51b7887468b5e0e7a7de4f4d34555112077f16e079019d5a845bd");
  const sharedSecret = u8FromHex("df4a291baa1eb7cfa6934b29b474baad2697e29f1f920dcc77c8a0a088447624");
  return calculateKeys(sharedSecret, helloHash, 384);
}
async function calculateKeys(sharedSecret, helloHash, hashLength) {
  const zeroKey = new Uint8Array(hashLength >> 3);
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashLength);
  console.log("early secret", hexFromU8(new Uint8Array(earlySecret)));
  const emptyHash = await crypto.subtle.digest(`SHA-${hashLength}`, new Uint8Array(0));
  console.log("empty hash", hexFromU8(new Uint8Array(emptyHash)));
}

// src/index.ts
calculateKeysTest();
