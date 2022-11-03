// src/util/bytes.ts
var textEncoder = new TextEncoder();

// src/util/tlsrecord.ts
var maxRecordLength = 1 << 14;

// src/keyscalc.ts
function u8FromHex(hex) {
  return new Uint8Array(Array.from(hex.matchAll(/../g)).map((hex2) => parseInt(hex2[0], 16)));
}
function hexFromU8(u8) {
  return [...u8].map((n) => n.toString(16).padStart(2, "0")).join("");
}
var txtEnc = new TextEncoder();
var tls13_Bytes = txtEnc.encode("tls13 ");
async function hkdfExtract(salt, keyMaterial, hashBits) {
  const hmacKey = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: { name: `SHA-${hashBits}` } }, false, ["sign"]);
  var prk = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, keyMaterial));
  return prk;
}
async function hkdfExpand(key, info, length, hashBits) {
  const hashBytes = hashBits >> 3;
  const n = Math.ceil(length / hashBytes);
  const okm = new Uint8Array(n * hashBytes);
  const hmacKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: { name: `SHA-${hashBits}` } }, false, ["sign"]);
  const infoLength = info.length;
  let tPrev = new Uint8Array(0);
  for (let i = 0; i < n; i++) {
    const tPrevLength = tPrev.length;
    const hmacData = new Uint8Array(tPrevLength + infoLength + 1);
    hmacData.set(tPrev);
    hmacData.set(info, tPrevLength);
    hmacData[tPrevLength + infoLength] = i + 1;
    const tiBuffer = await crypto.subtle.sign("HMAC", hmacKey, hmacData);
    const ti = new Uint8Array(tiBuffer);
    okm.set(ti, hashBytes * i);
    tPrev = ti;
  }
  return okm.subarray(0, length);
}
async function hkdfExpandLabel(key, label, context, length, hashBits) {
  const labelLength = label.length;
  const contextLength = context.length;
  const hkdfLabel = new Uint8Array(2 + 1 + 6 + labelLength + 1 + contextLength);
  hkdfLabel[0] = (length & 65280) >> 8;
  hkdfLabel[1] = length & 255;
  hkdfLabel[2] = labelLength + 6;
  hkdfLabel.set(tls13_Bytes, 2 + 1);
  hkdfLabel.set(label, 2 + 1 + 6);
  hkdfLabel[2 + 1 + 6 + labelLength] = contextLength;
  hkdfLabel.set(context, 2 + 1 + 6 + labelLength + 1);
  return hkdfExpand(key, hkdfLabel, length, hashBits);
}
async function calculateKeysTest() {
  const helloHash = u8FromHex("e05f64fcd082bdb0dce473adf669c2769f257a1c75a51b7887468b5e0e7a7de4f4d34555112077f16e079019d5a845bd");
  const sharedSecret = u8FromHex("df4a291baa1eb7cfa6934b29b474baad2697e29f1f920dcc77c8a0a088447624");
  return calculateKeys(sharedSecret, helloHash, 384);
}
async function calculateKeys(sharedSecret, helloHash, hashBits) {
  const hashBytes = hashBits >> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashBits);
  console.log("early secret", hexFromU8(new Uint8Array(earlySecret)));
  const emptyHashBuffer = await crypto.subtle.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  console.log("empty hash", hexFromU8(emptyHash));
  const derivedSecret = await hkdfExpandLabel(earlySecret, txtEnc.encode("derived"), emptyHash, hashBytes, hashBits);
  console.log("derived secret", hexFromU8(derivedSecret));
  const handshakeSecret = await hkdfExtract(derivedSecret, sharedSecret, hashBits);
  console.log("handshake secret", hexFromU8(handshakeSecret));
  const clientSecret = await hkdfExpandLabel(handshakeSecret, txtEnc.encode("c hs traffic"), helloHash, hashBytes, hashBits);
  console.log("client secret", hexFromU8(clientSecret));
  const serverSecret = await hkdfExpandLabel(handshakeSecret, txtEnc.encode("s hs traffic"), helloHash, hashBytes, hashBits);
  console.log("server secret", hexFromU8(serverSecret));
  const clientHandshakeKey = await hkdfExpandLabel(clientSecret, txtEnc.encode("key"), new Uint8Array(0), 32, hashBits);
  console.log("client handshake key", hexFromU8(clientHandshakeKey));
  const serverHandshakeKey = await hkdfExpandLabel(serverSecret, txtEnc.encode("key"), new Uint8Array(0), 32, hashBits);
  console.log("server handshake key", hexFromU8(serverHandshakeKey));
  const clientHandshakeIV = await hkdfExpandLabel(clientSecret, txtEnc.encode("iv"), new Uint8Array(0), 12, hashBits);
  console.log("client handshake iv", hexFromU8(clientHandshakeIV));
  const serverHandshakeIV = await hkdfExpandLabel(serverSecret, txtEnc.encode("iv"), new Uint8Array(0), 12, hashBits);
  console.log("server handshake iv", hexFromU8(serverHandshakeIV));
  return { serverHandshakeKey, serverHandshakeIV, clientHandshakeKey, clientHandshakeIV };
}

// src/index.ts
calculateKeysTest();
