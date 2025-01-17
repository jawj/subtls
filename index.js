var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true,
writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/hextreme/index.mjs
var __defProp2 = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, {
  enumerable: true,
  configurable: true,
  writable: true,
  value
}) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp2(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp2(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var chunkBytes = 1008e3;
var littleEndian = new Uint8Array(new Uint16Array([258]).buffer)[0] === 2;
var td = new TextDecoder();
var te = new TextEncoder();
var hexCharsLower = te.encode("0123456789abcdef");
var hexCharsUpper = te.encode("0123456789ABCDEF");
var b64ChStd = te.encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
var b64ChPad = 61;
var b64ChUrl = b64ChStd.slice();
b64ChUrl[62] = 45;
b64ChUrl[63] = 95;
var ccl;
var ccu;
function _toHex(in8, { alphabet, scratchArr } = {}) {
  if (!ccl) {
    ccl = new Uint16Array(256);
    ccu = new Uint16Array(256);
    if (littleEndian) for (let i2 = 0; i2 < 256; i2++) {
      ccl[i2] = hexCharsLower[i2 & 15] << 8 | hexCharsLower[i2 >>> 4];
      ccu[i2] = hexCharsUpper[i2 & 15] << 8 | hexCharsUpper[i2 >>> 4];
    }
    else for (let i2 = 0; i2 < 256; i2++) {
      ccl[i2] = hexCharsLower[i2 & 15] | hexCharsLower[i2 >>> 4] << 8;
      ccu[i2] = hexCharsUpper[i2 & 15] | hexCharsUpper[i2 >>> 4] << 8;
    }
  }
  if (in8.byteOffset % 4 !== 0) in8 = new Uint8Array(in8);
  const len = in8.length, halfLen = len >>> 1, quarterLen = len >>> 2, out16 = scratchArr || new Uint16Array(len),
  in32 = new Uint32Array(
    in8.buffer,
    in8.byteOffset,
    quarterLen
  ), out32 = new Uint32Array(out16.buffer, out16.byteOffset, halfLen), cc = alphabet === "upper" ? ccu : ccl;
  let i = 0, j = 0, v;
  if (littleEndian) while (i < quarterLen) {
    v = in32[i++];
    out32[j++] = cc[v >>> 8 & 255] << 16 | cc[v & 255];
    out32[j++] = cc[v >>> 24] << 16 | cc[v >>> 16 & 255];
  }
  else while (i < quarterLen) {
    v = in32[i++];
    out32[j++] = cc[v >>> 24] << 16 | cc[v >>> 16 & 255];
    out32[j++] = cc[v >>> 8 & 255] << 16 | cc[v & 255];
  }
  i <<= 2;
  while (i < len) out16[i] = cc[in8[i++]];
  const hex = td.decode(out16.subarray(0, len));
  return hex;
}
function _toHexChunked(d, options = {}) {
  let hex = "", len = d.length, chunkWords = chunkBytes >>> 1, chunks = Math.ceil(len / chunkWords), scratchArr = new Uint16Array(
    chunks > 1 ? chunkWords : len
  );
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkWords, end = start + chunkWords;
    hex += _toHex(d.subarray(start, end), __spreadProps(__spreadValues({}, options), { scratchArr }));
  }
  return hex;
}
function toHex(d, options = {}) {
  return options.alphabet !== "upper" && typeof d.toHex === "function" ? d.toHex() : _toHexChunked(d, options);
}
var vff = 26214;
var hl;
function _fromHex(s, { onInvalidInput, scratchArray: scratchArr, outArray: outArr, indexOffset } = {}) {
  if (!hl) {
    hl = new Uint8Array(vff + 1);
    for (let l = 0; l < 22; l++) for (let r = 0; r < 22; r++) {
      const cl = l + (l < 10 ? 48 : l < 16 ? 55 : 81), cr = r + (r < 10 ? 48 : r < 16 ? 55 : 81), vin = littleEndian ?
      cr << 8 | cl : cr | cl << 8, vout = (l < 16 ? l : l - 6) << 4 | (r < 16 ? r : r - 6);
      hl[vin] = vout;
    }
  }
  const lax = onInvalidInput === "truncate", slen = s.length;
  if (!lax && slen & 1) throw new Error("Hex input is an odd number of characters");
  const bytelen = slen >>> 1, last7 = bytelen - 7, h16len = bytelen + 2, h16 = scratchArr || new Uint16Array(h16len),
  h8 = new Uint8Array(
    h16.buffer,
    h16.byteOffset
  ), out = outArr || new Uint8Array(bytelen);
  if (h16.length < h16len) throw new Error(`Wrong-sized scratch array supplied (was ${h16.length}, expected at\
 least ${h16len})`);
  if (out.length != bytelen) throw new Error(`Wrong-sized output array supplied (was ${out.length}, expected ${bytelen}\
)`);
  te.encodeInto(s, h8);
  let i = 0, ok = false;
  e: {
    let vin, vout;
    while (i < last7) {
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
    }
    while (i < bytelen) {
      vin = h16[i];
      vout = hl[vin];
      if (!vout && vin !== 12336) break e;
      out[i++] = vout;
    }
    ok = true;
  }
  if (!ok && !lax) throw new Error(`Invalid pair in hex input at index ${(indexOffset || 0) + i << 1}`);
  return i < bytelen ? out.subarray(0, i) : out;
}
function _fromHexChunked(s, { onInvalidInput, outArray } = {}) {
  const lax = onInvalidInput === "truncate", slen = s.length;
  if (!lax && slen & 1) throw new Error("Hex input is an odd number of characters");
  const byteLength = slen >>> 1, chunkInts = chunkBytes >>> 1, chunksCount = Math.ceil(byteLength / chunkInts),
  scratchArr = new Uint16Array(
    (chunksCount > 1 ? chunkInts : byteLength) + 2
  ), outArr = outArray || new Uint8Array(byteLength);
  if (outArr.length !== byteLength) throw new Error(`Provided output array is of wrong length: expected ${byteLength}\
, got ${outArr.length}`);
  for (let i = 0; i < chunksCount; i++) {
    const chunkStartByte = i * chunkInts, chunkEndByte = chunkStartByte + chunkInts, result = _fromHex(s.slice(
      chunkStartByte << 1,
      chunkEndByte << 1
    ), {
      onInvalidInput,
      scratchArray: scratchArr,
      outArray: outArr.subarray(chunkStartByte, chunkEndByte),
      indexOffset: chunkStartByte
    });
    if (lax && result.length < chunkEndByte - chunkStartByte) {
      return outArr.subarray(0, chunkStartByte + result.length);
    }
  }
  return outArr;
}
function fromHex(s, options = {}) {
  if (typeof Uint8Array.fromHex === "function" && options.onInvalidInput !== "truncate" && !options.outArray) return Uint8Array.
  fromHex(
    s
  );
  return _fromHexChunked(s, options);
}
var chpairsStd;
var chpairsUrl;
function _toBase64(d, { omitPadding, alphabet, scratchArr } = {}) {
  if (!chpairsStd) {
    chpairsStd = new Uint16Array(4096);
    if (littleEndian) for (let i2 = 0; i2 < 64; i2++) for (let j2 = 0; j2 < 64; j2++) chpairsStd[i2 << 6 | j2] =
    b64ChStd[i2] | b64ChStd[j2] << 8;
    else for (let i2 = 0; i2 < 64; i2++) for (let j2 = 0; j2 < 64; j2++) chpairsStd[i2 << 6 | j2] = b64ChStd[i2] <<
    8 | b64ChStd[j2];
    chpairsUrl = chpairsStd.slice();
    if (littleEndian) {
      for (let i2 = 0; i2 < 64; i2++) for (let j2 = 62; j2 < 64; j2++) chpairsUrl[i2 << 6 | j2] = b64ChUrl[i2] |
      b64ChUrl[j2] << 8;
      for (let i2 = 62; i2 < 64; i2++) for (let j2 = 0; j2 < 62; j2++) chpairsUrl[i2 << 6 | j2] = b64ChUrl[i2] |
      b64ChUrl[j2] << 8;
    } else {
      for (let i2 = 0; i2 < 64; i2++) for (let j2 = 62; j2 < 64; j2++) chpairsUrl[i2 << 6 | j2] = b64ChUrl[i2] <<
      8 | b64ChUrl[j2];
      for (let i2 = 62; i2 < 64; i2++) for (let j2 = 0; j2 < 62; j2++) chpairsUrl[i2 << 6 | j2] = b64ChUrl[i2] <<
      8 | b64ChUrl[j2];
    }
  }
  if (d.byteOffset % 4 !== 0) d = new Uint8Array(d);
  const urlsafe = alphabet === "base64url", ch = urlsafe ? b64ChUrl : b64ChStd, chpairs = urlsafe ? chpairsUrl :
  chpairsStd, inlen = d.length, last2 = inlen - 2, inints = inlen >>> 2, intlast3 = inints - 3, d32 = new Uint32Array(
  d.buffer, d.byteOffset, inints), outints = Math.ceil(inlen / 3), out = scratchArr || new Uint32Array(outints);
  let i = 0, j = 0, u1, u2, u3, b1, b2, b3;
  if (littleEndian) while (i < intlast3) {
    u1 = d32[i++];
    u2 = d32[i++];
    u3 = d32[i++];
    b1 = u1 & 255;
    b2 = u1 >>> 8 & 255;
    b3 = u1 >>> 16 & 255;
    out[j++] = chpairs[b1 << 4 | b2 >>> 4] | chpairs[(b2 & 15) << 8 | b3] << 16;
    b1 = u1 >>> 24;
    b2 = u2 & 255;
    b3 = u2 >>> 8 & 255;
    out[j++] = chpairs[b1 << 4 | b2 >>> 4] | chpairs[(b2 & 15) << 8 | b3] << 16;
    b1 = u2 >>> 16 & 255;
    b2 = u2 >>> 24;
    b3 = u3 & 255;
    out[j++] = chpairs[b1 << 4 | b2 >>> 4] | chpairs[(b2 & 15) << 8 | b3] << 16;
    b1 = u3 >>> 8 & 255;
    b2 = u3 >>> 16 & 255;
    b3 = u3 >>> 24;
    out[j++] = chpairs[b1 << 4 | b2 >>> 4] | chpairs[(b2 & 15) << 8 | b3] << 16;
  }
  else while (i < intlast3) {
    u1 = d32[i++];
    u2 = d32[i++];
    u3 = d32[i++];
    out[j++] = chpairs[u1 >>> 20] << 16 | chpairs[u1 >>> 8 & 4095];
    out[j++] = chpairs[(u1 & 255) << 4 | u2 >>> 28] << 16 | chpairs[u2 >>> 16 & 4095];
    out[j++] = chpairs[u2 >>> 4 & 4095] << 16 | chpairs[(u2 & 15) << 8 | u3 >>> 24];
    out[j++] = chpairs[u3 >>> 12 & 4095] << 16 | chpairs[u3 & 4095];
  }
  i = i << 2;
  while (i < last2) {
    b1 = d[i++];
    b2 = d[i++];
    b3 = d[i++];
    out[j++] = chpairs[b1 << 4 | b2 >>> 4] << (littleEndian ? 0 : 16) | chpairs[(b2 & 15) << 8 | b3] << (littleEndian ?
    16 : 0);
  }
  if (i === inlen) return td.decode(out);
  b1 = d[i++];
  b2 = d[i++];
  out[j++] = chpairs[b1 << 4 | (b2 || 0) >>> 4] << (littleEndian ? 0 : 16) | // first 16 bits (no padding)
  (b2 === void 0 ? b64ChPad : ch[((b2 || 0) & 15) << 2]) << (littleEndian ? 16 : 8) | // next 8 bits
  b64ChPad << (littleEndian ? 24 : 0);
  if (!omitPadding) return td.decode(out);
  let out8 = new Uint8Array(out.buffer, 0, (outints << 2) - (b2 === void 0 ? 2 : 1));
  return td.decode(out8);
}
function _toBase64Chunked(d, options = {}) {
  const inBytes = d.length, outInts = Math.ceil(inBytes / 3), outChunkInts = chunkBytes >>> 2, chunksCount = Math.
  ceil(outInts / outChunkInts), inChunkBytes = outChunkInts * 3, scratchArr = new Uint32Array(chunksCount > 1 ?
  outChunkInts : outInts);
  let b64 = "";
  for (let i = 0; i < chunksCount; i++) {
    const startInBytes = i * inChunkBytes, endInBytes = startInBytes + inChunkBytes, startOutInts = i * outChunkInts,
    endOutInts = Math.min(startOutInts + outChunkInts, outInts);
    b64 += _toBase64(d.subarray(startInBytes, endInBytes), __spreadProps(__spreadValues({}, options), {
      scratchArr: scratchArr.subarray(0, endOutInts - startOutInts)
    }));
  }
  return b64;
}
function toBase64(d, options = {}) {
  return typeof d.toBase64 === "function" ? d.toBase64(options) : _toBase64Chunked(d, options);
}
var vzz = 31354;
var stdWordLookup;
var urlWordLookup;
var anyWordLookup;
var stdByteLookup;
var urlByteLookup;
var anyByteLookup;
function _fromBase64(s, { alphabet, onInvalidInput } = {}) {
  const lax = onInvalidInput === "skip";
  if (!stdWordLookup && alphabet !== "base64url" && alphabet !== "base64any") {
    stdWordLookup = new Uint16Array(vzz + 1);
    for (let l = 0; l < 64; l++) for (let r = 0; r < 64; r++) {
      const cl = b64ChStd[l], cr = b64ChStd[r], vin = littleEndian ? cr << 8 | cl : cr | cl << 8, vout = l << 6 |
      r;
      stdWordLookup[vin] = vout;
    }
  }
  if (!urlWordLookup && alphabet === "base64url") {
    urlWordLookup = new Uint16Array(vzz + 1);
    for (let l = 0; l < 64; l++) for (let r = 0; r < 64; r++) {
      const cl = b64ChUrl[l], cr = b64ChUrl[r], vin = littleEndian ? cr << 8 | cl : cr | cl << 8, vout = l << 6 |
      r;
      urlWordLookup[vin] = vout;
    }
  }
  if (!anyWordLookup && alphabet === "base64any") {
    anyWordLookup = new Uint16Array(vzz + 1);
    for (let l = 0; l < 64; l++) for (let r = 0; r < 64; r++) {
      const cl = b64ChStd[l], cr = b64ChStd[r], vin = littleEndian ? cr << 8 | cl : cr | cl << 8, vout = l << 6 |
      r;
      anyWordLookup[vin] = vout;
      if (l > 61 || r > 61) {
        const cl2 = b64ChUrl[l], cr2 = b64ChUrl[r], vin2 = littleEndian ? cr2 << 8 | cl2 : cr2 | cl2 << 8;
        anyWordLookup[vin2] = vout;
      }
    }
  }
  if (!stdByteLookup) {
    stdByteLookup = new Uint8Array(256).fill(66);
    urlByteLookup = new Uint8Array(256).fill(66);
    anyByteLookup = new Uint8Array(256).fill(66);
    stdByteLookup[b64ChPad] = urlByteLookup[b64ChPad] = anyByteLookup[b64ChPad] = 65;
    stdByteLookup[9] = stdByteLookup[10] = stdByteLookup[13] = stdByteLookup[32] = // tab, \r, \n, space
    urlByteLookup[9] = urlByteLookup[10] = urlByteLookup[13] = urlByteLookup[32] = anyByteLookup[9] = anyByteLookup[10] =
    anyByteLookup[13] = anyByteLookup[32] = 64;
    for (let i2 = 0; i2 < 64; i2++) {
      const chStdI = b64ChStd[i2], chUrlI = b64ChUrl[i2];
      stdByteLookup[chStdI] = urlByteLookup[chUrlI] = anyByteLookup[chStdI] = anyByteLookup[chUrlI] = i2;
    }
  }
  const inBytes = te.encode(s), inBytesLen = inBytes.length, inIntsLen = inBytesLen >>> 2, inInts = new Uint32Array(
    inBytes.buffer,
    inBytes.byteOffset,
    inIntsLen
  ), last3 = inIntsLen - 3, maxOutBytesLen = inIntsLen * 3 + inBytesLen % 4, outBytes = new Uint8Array(
    maxOutBytesLen
  ), outInts = new Uint32Array(outBytes.buffer, 0, maxOutBytesLen >>> 2), wl = alphabet === "base64url" ? urlWordLookup :
  alphabet === "base64any" ? anyWordLookup : stdWordLookup, bl = alphabet === "base64url" ? urlByteLookup : alphabet ===
  "base64any" ? anyByteLookup : stdByteLookup;
  let i = 0, j = 0, inInt, inL, inR, vL1, vR1, vL2, vR2, vL3, vR3, vL4, vR4;
  if (littleEndian) while (i < last3) {
    inInt = inInts[i++];
    inL = inInt & 65535;
    inR = inInt >>> 16;
    vL1 = wl[inL];
    vR1 = wl[inR];
    if (!((vL1 || inL === 16705) && (vR1 || inR === 16705))) {
      i -= 1;
      break;
    }
    inInt = inInts[i++];
    inL = inInt & 65535;
    inR = inInt >>> 16;
    vL2 = wl[inL];
    vR2 = wl[inR];
    if (!((vL2 || inL === 16705) && (vR2 || inR === 16705))) {
      i -= 2;
      break;
    }
    inInt = inInts[i++];
    inL = inInt & 65535;
    inR = inInt >>> 16;
    vL3 = wl[inL];
    vR3 = wl[inR];
    if (!((vL3 || inL === 16705) && (vR3 || inR === 16705))) {
      i -= 3;
      break;
    }
    inInt = inInts[i++];
    inL = inInt & 65535;
    inR = inInt >>> 16;
    vL4 = wl[inL];
    vR4 = wl[inR];
    if (!((vL4 || inL === 16705) && (vR4 || inR === 16705))) {
      i -= 4;
      break;
    }
    outInts[j++] = vL1 >>> 4 | (vL1 & 15) << 12 | vR1 & 65280 | (vR1 & 255) << 16 | (vL2 & 4080) << 20;
    outInts[j++] = (vL2 & 15) << 4 | (vR2 & 65280) >>> 8 | (vR2 & 255) << 8 | (vL3 & 4080) << 12 | (vL3 & 15) <<
    28 | (vR3 & 65280) << 16;
    outInts[j++] = vR3 & 255 | (vL4 & 4080) << 4 | (vL4 & 15) << 20 | (vR4 & 3840) << 8 | vR4 << 24;
  }
  else while (i < last3) {
    inInt = inInts[i++];
    inL = inInt >>> 16;
    inR = inInt & 65535;
    vL1 = wl[inL];
    vR1 = wl[inR];
    if (!((vL1 || inL === 16705) && (vR1 || inR === 16705))) {
      i -= 1;
      break;
    }
    inInt = inInts[i++];
    inL = inInt >>> 16;
    inR = inInt & 65535;
    vL2 = wl[inL];
    vR2 = wl[inR];
    if (!((vL2 || inL === 16705) && (vR2 || inR === 16705))) {
      i -= 2;
      break;
    }
    inInt = inInts[i++];
    inL = inInt >>> 16;
    inR = inInt & 65535;
    vL3 = wl[inL];
    vR3 = wl[inR];
    if (!((vL3 || inL === 16705) && (vR3 || inR === 16705))) {
      i -= 3;
      break;
    }
    inInt = inInts[i++];
    inL = inInt >>> 16;
    inR = inInt & 65535;
    vL4 = wl[inL];
    vR4 = wl[inR];
    if (!((vL4 || inL === 16705) && (vR4 || inR === 16705))) {
      i -= 4;
      break;
    }
    outInts[j++] = vL1 << 20 | vR1 << 8 | vL2 >>> 4;
    outInts[j++] = (vL2 & 15) << 28 | vR2 << 16 | vL3 << 4 | vR3 >>> 8;
    outInts[j++] = (vR3 & 255) << 24 | vL4 << 12 | vR4;
  }
  i <<= 2;
  j <<= 2;
  if (i === inBytesLen) return outBytes;
  let i0 = i, ok = false;
  e: {
    if (lax) while (i < inBytesLen) {
      i0 = i;
      while ((vL1 = bl[inBytes[i++]]) > 63) if (vL1 === 65) ok = true;
      while ((vL2 = bl[inBytes[i++]]) > 63) if (vL2 === 65) ok = true;
      while ((vL3 = bl[inBytes[i++]]) > 63) if (vL3 === 65) ok = true;
      while ((vL4 = bl[inBytes[i++]]) > 63) if (vL4 === 65) ok = true;
      outBytes[j++] = vL1 << 2 | vL2 >>> 4;
      outBytes[j++] = (vL2 << 4 | vL3 >>> 2) & 255;
      outBytes[j++] = (vL3 << 6 | vL4) & 255;
      if (ok) break;
    }
    else while (i < inBytesLen) {
      i0 = i;
      while ((vL1 = bl[inBytes[i++]]) > 63) if (vL1 === 66) break e;
      else if (vL1 === 65) ok = true;
      while ((vL2 = bl[inBytes[i++]]) > 63) if (vL2 === 66) break e;
      else if (vL2 === 65) ok = true;
      while ((vL3 = bl[inBytes[i++]]) > 63) if (vL3 === 66) break e;
      else if (vL3 === 65) ok = true;
      while ((vL4 = bl[inBytes[i++]]) > 63) if (vL4 === 66) break e;
      else if (vL4 === 65) ok = true;
      outBytes[j++] = vL1 << 2 | vL2 >>> 4;
      outBytes[j++] = (vL2 << 4 | vL3 >>> 2) & 255;
      outBytes[j++] = (vL3 << 6 | vL4) & 255;
      if (ok) break;
    }
    ok = true;
  }
  if (!ok) throw new Error(`Invalid character in base64 at index ${i - 1}`);
  let validChars = 0;
  for (i = i0; i < inBytesLen; i++) {
    const v = bl[inBytes[i]];
    if (v < 64) validChars++;
    if (v === 65) break;
  }
  if (!lax) for (i = i0; i < inBytesLen; i++) {
    const v = bl[inBytes[i]];
    if (v > 65) throw new Error(`Invalid character in base64 after padding`);
  }
  const truncateBytes = { 4: 0, 3: 1, 2: 2, 1: 3, 0: 3 }[validChars];
  return outBytes.subarray(0, j - truncateBytes);
}
function fromBase64(s, options = {}) {
  if (typeof Uint8Array.fromBase64 === "function" && options.onInvalidInput !== "skip" && options.alphabet !==
  "base64any") return Uint8Array.fromBase64(s, options);
  return _fromBase64(s, options);
}

// src/util/array.ts
function concat(...arrs) {
  if (arrs.length === 1 && arrs[0] instanceof Uint8Array) return arrs[0];
  const length = arrs.reduce((memo, arr) => memo + arr.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const arr of arrs) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
function equal(a, b) {
  const aLength = a.length;
  if (aLength !== b.length) return false;
  for (let i = 0; i < aLength; i++) if (a[i] !== b[i]) return false;
  return true;
}
var GrowableData = class {
  constructor() {
    __publicField(this, "length");
    __publicField(this, "data");
    this.length = 0;
    this.data = new Uint8Array();
  }
  append(newData) {
    const newDataLength = newData.length;
    if (this.length + newDataLength > this.data.length) {
      const prevData = this.data;
      this.data = new Uint8Array(this.length * 2 + newDataLength);
      this.data.set(prevData);
    }
    this.data.set(newData, this.length);
    this.length += newData.length;
  }
  getData() {
    return this.data.subarray(0, this.length);
  }
};

// src/presentation/appearance.ts
var indentChars = "\xB7\xB7 ";

// src/util/bytes.ts
var initialSize = 1024;
var growthFactor = 2;
var txtEnc = new TextEncoder();
var txtDec = new TextDecoder();
var emptyArray = new Uint8Array(0);
var Bytes = class {
  /**
   * @param data -
   * * If data is a `Uint8Array`, this is the initial data
   * * If data is a `number`, this is the initial size in bytes (all zeroes)
   * * If data is a `function`, this function is called to retrieve data when required
   */
  constructor(data, indent = 0) {
    this.indent = indent;
    __publicField(this, "fetchFn");
    __publicField(this, "endOfReadableData");
    // how much data exists to read (not used for writing)
    __publicField(this, "offset");
    // current read/write cursor
    __publicField(this, "dataView");
    __publicField(this, "data");
    __publicField(this, "comments");
    __publicField(this, "indents");
    this.endOfReadableData = this.offset = 0;
    this.comments = {};
    this.indents = { 0: indent };
    if (typeof data === "number") {
      this.data = new Uint8Array(data);
    } else if (data === void 0 || typeof data === "function") {
      this.data = emptyArray;
      this.fetchFn = data;
    } else {
      this.data = data;
      this.endOfReadableData = data.length;
    }
    this.dataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }
  readRemaining() {
    return this.endOfReadableData - this.offset;
  }
  resizeTo(newSize) {
    const newData = new Uint8Array(newSize);
    newData.set(this.data);
    this.data = newData;
    this.dataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }
  async ensureReadAvailable(bytes) {
    if (bytes <= this.readRemaining()) return;
    if (this.fetchFn === void 0) throw new Error("Not enough data and no read function supplied");
    const freeSpace = this.data.length - this.endOfReadableData;
    if (bytes > freeSpace) {
      const newSize = Math.max(
        initialSize,
        this.data.length * growthFactor,
        this.endOfReadableData + bytes
      );
      this.resizeTo(newSize);
    }
    const newData = await this.fetchFn(bytes);
    if (newData === void 0 || newData.length < bytes) {
      const e = new Error(`Not enough data returned by read function. 
  data.length:       ${this.data.length}
  endOfReadableData: ${this.endOfReadableData}
  offset:            ${this.offset}
  bytes requested:   ${bytes}
  bytes returned:    ${newData && newData.length}`);
      e._bytes_error_reason = "EOF";
      throw e;
    }
    this.data.set(newData, this.endOfReadableData);
    this.endOfReadableData += newData.length;
  }
  ensureWriteAvailable(bytes) {
    if (this.offset + bytes < this.data.length) return;
    const newSize = Math.max(
      initialSize,
      this.data.length * growthFactor,
      this.offset + bytes
    );
    this.resizeTo(newSize);
  }
  expectLength(length, indentDelta = 1) {
    const startOffset = this.offset;
    const endOffset = startOffset + length;
    this.indent += indentDelta;
    this.indents[startOffset] = this.indent;
    return [
      () => {
        this.indent -= indentDelta;
        this.indents[this.offset] = this.indent;
        if (this.offset !== endOffset) throw new Error(`${length} bytes expected but ${this.offset - startOffset}\
 advanced`);
      },
      () => endOffset - this.offset
    ];
  }
  comment(s, offset = this.offset) {
    if (true) throw new Error("No comments should be emitted outside of chatty mode");
    const existing = this.comments[offset];
    const result = (existing === void 0 ? "" : existing + " ") + s;
    this.comments[offset] = result;
    return this;
  }
  lengthComment(length, comment, inclusive = false) {
    return length === 1 ? `${length} byte${comment ? ` of ${comment}` : ""} ${inclusive ? "starts here" : "fol\
lows"}` : `${length === 0 ? "no" : length} bytes${comment ? ` of ${comment}` : ""} ${inclusive ? "start here" :
    "follow"}`;
  }
  // reading
  async subarrayForRead(length) {
    await this.ensureReadAvailable(length);
    return this.data.subarray(this.offset, this.offset += length);
  }
  async skipRead(length, comment) {
    await this.ensureReadAvailable(length);
    this.offset += length;
    if (comment) this.comment(comment);
    return this;
  }
  async readBytes(length) {
    await this.ensureReadAvailable(length);
    return this.data.slice(this.offset, this.offset += length);
  }
  async readUTF8String(length) {
    await this.ensureReadAvailable(length);
    const bytes = await this.subarrayForRead(length);
    const s = txtDec.decode(bytes);
    return s;
  }
  async readUTF8StringNullTerminated() {
    let i = 0;
    while (true) {
      await this.ensureReadAvailable(i + 1);
      const charCode = this.data[this.offset + i];
      if (charCode === 0) break;
      i++;
    }
    ;
    const str = await this.readUTF8String(i);
    await this.expectUint8(0, "end of string");
    return str;
  }
  async readUint8(comment) {
    await this.ensureReadAvailable(1);
    const result = this.dataView.getUint8(this.offset);
    this.offset += 1;
    if (0) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  async readUint16(comment) {
    await this.ensureReadAvailable(2);
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    if (0) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  async readUint24(comment) {
    await this.ensureReadAvailable(3);
    const msb = await this.readUint8();
    const lsbs = await this.readUint16();
    const result = (msb << 16) + lsbs;
    if (0) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  async readUint32(comment) {
    await this.ensureReadAvailable(4);
    const result = this.dataView.getUint32(this.offset);
    this.offset += 4;
    if (0) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  async expectBytes(expected, comment) {
    await this.ensureReadAvailable(expected.length);
    const actual = await this.readBytes(expected.length);
    if (0) this.comment(comment);
    if (!equal(actual, expected)) throw new Error("Unexpected bytes");
  }
  async expectUint8(expectedValue, comment) {
    const actualValue = await this.readUint8();
    if (0) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  async expectUint16(expectedValue, comment) {
    const actualValue = await this.readUint16();
    if (0) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  async expectUint24(expectedValue, comment) {
    const actualValue = await this.readUint24();
    if (0) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  async expectUint32(expectedValue, comment) {
    const actualValue = await this.readUint32();
    if (0) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected ${expectedValue}, got ${actualValue}`);
  }
  async expectReadLength(length, indentDelta = 1) {
    await this.ensureReadAvailable(length);
    return this.expectLength(length, indentDelta);
  }
  async expectLengthUint8(comment) {
    const length = await this.readUint8();
    return this.expectReadLength(length);
  }
  async expectLengthUint16(comment) {
    const length = await this.readUint16();
    return this.expectReadLength(length);
  }
  async expectLengthUint24(comment) {
    const length = await this.readUint24();
    return this.expectReadLength(length);
  }
  async expectLengthUint32(comment) {
    const length = await this.readUint32();
    return this.expectReadLength(length);
  }
  async expectLengthUint8Incl(comment) {
    const length = await this.readUint8();
    return this.expectReadLength(length - 1);
  }
  async expectLengthUint16Incl(comment) {
    const length = await this.readUint16();
    return this.expectReadLength(length - 2);
  }
  async expectLengthUint24Incl(comment) {
    const length = await this.readUint24();
    return this.expectReadLength(length - 3);
  }
  async expectLengthUint32Incl(comment) {
    const length = await this.readUint32();
    return this.expectReadLength(length - 4);
  }
  // writing
  subarrayForWrite(length) {
    this.ensureWriteAvailable(length);
    return this.data.subarray(this.offset, this.offset += length);
  }
  skipWrite(length, comment) {
    this.ensureWriteAvailable(length);
    this.offset += length;
    if (comment) this.comment(comment);
    return this;
  }
  writeBytes(bytes) {
    this.ensureWriteAvailable(bytes.length);
    this.data.set(bytes, this.offset);
    this.offset += bytes.length;
    return this;
  }
  writeUTF8String(s) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    return this;
  }
  writeUTF8StringNullTerminated(s) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    this.writeUint8(0);
    return this;
  }
  writeUint8(value, comment) {
    this.ensureWriteAvailable(1);
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
    if (0) this.comment(comment);
    return this;
  }
  writeUint16(value, comment) {
    this.ensureWriteAvailable(2);
    this.dataView.setUint16(this.offset, value);
    this.offset += 2;
    if (0) this.comment(comment);
    return this;
  }
  writeUint24(value, comment) {
    this.writeUint8((value & 16711680) >> 16);
    this.writeUint16(value & 65535, comment);
    return this;
  }
  writeUint32(value, comment) {
    this.ensureWriteAvailable(4);
    this.dataView.setUint32(this.offset, value);
    this.offset += 4;
    if (0) this.comment(comment);
    return this;
  }
  // forward-looking lengths
  _writeLengthGeneric(lengthBytes, inclusive, comment) {
    this.ensureWriteAvailable(lengthBytes);
    const startOffset = this.offset;
    this.offset += lengthBytes;
    const endOffset = this.offset;
    this.indent += 1;
    this.indents[endOffset] = this.indent;
    return () => {
      const length = this.offset - (inclusive ? startOffset : endOffset);
      switch (lengthBytes) {
        case 1:
          this.dataView.setUint8(startOffset, length);
          break;
        case 2:
          this.dataView.setUint16(startOffset, length);
          break;
        case 3:
          this.dataView.setUint8(startOffset, (length & 16711680) >> 16);
          this.dataView.setUint16(startOffset + 1, length & 65535);
          break;
        case 4:
          this.dataView.setUint32(startOffset, length);
          break;
        default:
          throw new Error(`Invalid length for length field: ${lengthBytes}`);
      }
      this.indent -= 1;
      this.indents[this.offset] = this.indent;
    };
  }
  writeLengthUint8(comment) {
    return this._writeLengthGeneric(1, false, comment);
  }
  writeLengthUint16(comment) {
    return this._writeLengthGeneric(2, false, comment);
  }
  writeLengthUint24(comment) {
    return this._writeLengthGeneric(3, false, comment);
  }
  writeLengthUint32(comment) {
    return this._writeLengthGeneric(4, false, comment);
  }
  writeLengthUint8Incl(comment) {
    return this._writeLengthGeneric(1, true, comment);
  }
  writeLengthUint16Incl(comment) {
    return this._writeLengthGeneric(2, true, comment);
  }
  writeLengthUint24Incl(comment) {
    return this._writeLengthGeneric(3, true, comment);
  }
  writeLengthUint32Incl(comment) {
    return this._writeLengthGeneric(4, true, comment);
  }
  expectWriteLength(length, indentDelta = 1) {
    this.ensureWriteAvailable(length);
    return this.expectLength(length, indentDelta);
  }
  // output
  array() {
    return this.data.subarray(0, this.offset);
  }
  commentedString(all = false) {
    let indent = this.indents[0] ?? 0;
    let s = indentChars.repeat(indent);
    const len = all ? this.data.length : this.offset;
    for (let i = 0; i < len; i++) {
      s += this.data[i].toString(16).padStart(2, "0") + " ";
      const comment = this.comments[i + 1];
      indent = this.indents[i + 1] ?? indent;
      if (comment) {
        s += ` ${comment}`;
        if (i < len - 1) s += `
${indentChars.repeat(indent)}`;
      }
    }
    return s;
  }
};

// src/util/cryptoRandom.ts
var cryptoPromise = typeof crypto !== "undefined" ? Promise.resolve(crypto) : (
  // browsers and Node 19+
  import("crypto").then((c) => c.webcrypto)
);
async function getRandomValues(...args) {
  const c = await cryptoPromise;
  return c.getRandomValues(...args);
}

// src/tls/makeClientHello.ts
async function makeClientHello(host, publicKey, sessionId, useSNI = true) {
  const h = new Bytes();
  h.writeUint8(22, 0);
  h.writeUint16(769, 0);
  const endRecordHeader = h.writeLengthUint16("TLS record");
  h.writeUint8(1, 0);
  const endHandshakeHeader = h.writeLengthUint24();
  h.writeUint16(771, 0);
  await getRandomValues(h.subarrayForWrite(32));
  const endSessionId = h.writeLengthUint8(0);
  h.writeBytes(sessionId);
  endSessionId();
  const endCiphers = h.writeLengthUint16(0);
  h.writeUint16(4865, 0);
  endCiphers();
  const endCompressionMethods = h.writeLengthUint8(0);
  h.writeUint8(0, 0);
  endCompressionMethods();
  const endExtensions = h.writeLengthUint16(0);
  if (useSNI) {
    h.writeUint16(0, 0);
    const endSNIExt = h.writeLengthUint16(0);
    const endSNI = h.writeLengthUint16(0);
    h.writeUint8(0, 0);
    const endHostname = h.writeLengthUint16(0);
    h.writeUTF8String(host);
    endHostname();
    endSNI();
    endSNIExt();
  }
  h.writeUint16(11, 0);
  const endFormatTypesExt = h.writeLengthUint16(0);
  const endFormatTypes = h.writeLengthUint8(0);
  h.writeUint8(0, 0);
  endFormatTypes();
  endFormatTypesExt();
  h.writeUint16(10, 0);
  const endGroupsExt = h.writeLengthUint16(0);
  const endGroups = h.writeLengthUint16(0);
  h.writeUint16(23, 0);
  endGroups();
  endGroupsExt();
  h.writeUint16(13, 0);
  const endSigsExt = h.writeLengthUint16(0);
  const endSigs = h.writeLengthUint16(0);
  h.writeUint16(1027, 0);
  h.writeUint16(2052, 0);
  endSigs();
  endSigsExt();
  h.writeUint16(43, 0);
  const endVersionsExt = h.writeLengthUint16(0);
  const endVersions = h.writeLengthUint8(0);
  h.writeUint16(772, 0);
  endVersions();
  endVersionsExt();
  h.writeUint16(51, 0);
  const endKeyShareExt = h.writeLengthUint16(0);
  const endKeyShares = h.writeLengthUint16(0);
  h.writeUint16(23, 0);
  const endKeyShare = h.writeLengthUint16(0);
  if (0) {
    h.writeUint8(publicKey[0], "legacy point format: always 4, which means uncompressed ([RFC 8446 \xA74.2.8.2](h\
ttps://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2) and [RFC 8422 \xA75.4.1](https://datatracker.ietf.o\
rg/doc/html/rfc8422#section-5.4.1))");
    h.writeBytes(publicKey.subarray(1, 33));
    h.comment("x coordinate");
    h.writeBytes(publicKey.subarray(33, 65));
    h.comment("y coordinate");
  } else {
    h.writeBytes(publicKey);
  }
  endKeyShare();
  endKeyShares();
  endKeyShareExt();
  endExtensions();
  endHandshakeHeader();
  endRecordHeader();
  return h;
}

// src/util/hex.ts
function u8FromHex(hex) {
  return new Uint8Array(Array.from(hex.matchAll(/[0-9a-f]/g)).map((hex2) => parseInt(hex2[0], 16)));
}
function hexFromU8(u8, spacer = "") {
  return [...u8].map((n) => n.toString(16).padStart(2, "0")).join(spacer);
}

// src/tls/parseServerHello.ts
async function parseServerHello(h, sessionId) {
  let serverPublicKey;
  let tlsVersionSpecified;
  await h.expectUint8(2, 0);
  const [endServerHello] = await h.expectLengthUint24(0);
  await h.expectUint16(771, 0);
  const serverRandom = await h.readBytes(32);
  if (equal(serverRandom, [
    // SHA-256 of "HelloRetryRequest", https://datatracker.ietf.org/doc/html/rfc8446#page-32
    // see also: echo -n "HelloRetryRequest" | openssl dgst -sha256 -hex
    207,
    33,
    173,
    116,
    229,
    154,
    97,
    17,
    190,
    29,
    140,
    2,
    30,
    101,
    184,
    145,
    194,
    162,
    17,
    22,
    122,
    187,
    140,
    94,
    7,
    158,
    9,
    226,
    200,
    168,
    51,
    156
  ])) throw new Error("Unexpected HelloRetryRequest");
  await h.expectUint8(sessionId.length, 0);
  await h.expectBytes(sessionId, 0);
  await h.expectUint16(4865, 0);
  await h.expectUint8(0, 0);
  const [endExtensions, extensionsRemaining] = await h.expectLengthUint16(0);
  while (extensionsRemaining() > 0) {
    const extensionType = await h.readUint16(0);
    const [endExtension] = await h.expectLengthUint16(0);
    if (extensionType === 43) {
      await h.expectUint16(772, 0);
      tlsVersionSpecified = true;
    } else if (extensionType === 51) {
      await h.expectUint16(23, 0);
      const [endKeyShare, keyShareRemaining] = await h.expectLengthUint16("key share");
      const keyShareLength = keyShareRemaining();
      if (keyShareLength !== 65) throw new Error(`Expected 65 bytes of key share, but got ${keyShareLength}`);
      if (0) {
        await h.expectUint8(4, "legacy point format: always 4, which means uncompressed ([RFC 8446 \xA74.2.8.2](h\
ttps://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2) and [RFC 8422 \xA75.4.1](https://datatracker.ietf.o\
rg/doc/html/rfc8422#section-5.4.1))");
        const x = await h.readBytes(32);
        h.comment("x coordinate");
        const y = await h.readBytes(32);
        h.comment("y coordinate");
        serverPublicKey = concat2([4], x, y);
      } else {
        serverPublicKey = await h.readBytes(keyShareLength);
      }
      endKeyShare();
    } else {
      throw new Error(`Unexpected extension 0x${hexFromU8([extensionType])}`);
    }
    endExtension();
  }
  endExtensions();
  endServerHello();
  if (tlsVersionSpecified !== true) throw new Error("No TLS version provided");
  if (serverPublicKey === void 0) throw new Error("No key provided");
  return serverPublicKey;
}

// src/tls/certUtils.ts
var universalTypeBoolean = 1;
var universalTypeInteger = 2;
var constructedUniversalTypeSequence = 48;
var constructedUniversalTypeSet = 49;
var universalTypeOID = 6;
var universalTypePrintableString = 19;
var universalTypeTeletexString = 20;
var universalTypeUTF8String = 12;
var universalTypeIA5String = 22;
var universalTypeUTCTime = 23;
var universalTypeGeneralizedTime = 24;
var universalTypeNull = 5;
var universalTypeOctetString = 4;
var universalTypeBitString = 3;
var constructedContextSpecificType = 163;
var contextSpecificType = 128;
var DNOIDMap = {
  "2.5.4.6": "C",
  // country
  "2.5.4.10": "O",
  // organisation
  "2.5.4.11": "OU",
  // organisational unit
  "2.5.4.3": "CN",
  // common name
  "2.5.4.7": "L",
  // locality
  "2.5.4.8": "ST",
  // state/province
  "2.5.4.12": "T",
  // title
  "2.5.4.42": "GN",
  // given name
  "2.5.4.43": "I",
  // initials
  "2.5.4.4": "SN",
  // surname
  "1.2.840.113549.1.9.1": "MAIL",
  "2.5.4.5": "SERIALNUMBER"
};
function intFromBitString(bs) {
  const { length } = bs;
  if (length > 4) throw new Error(`Bit string length ${length} would overflow JS bit operators`);
  let result = 0;
  let leftShift = 0;
  for (let i = bs.length - 1; i >= 0; i--) {
    result |= bs[i] << leftShift;
    leftShift += 8;
  }
  return result;
}
async function readSeqOfSetOfSeq(cb, seqType) {
  const result = {};
  const [endSeq, seqRemaining] = await cb.expectASN1Sequence(seqType);
  while (seqRemaining() > 0) {
    await cb.expectUint8(constructedUniversalTypeSet, 0);
    const [endItemSet] = await cb.expectASN1Length(0);
    const [endItemSeq] = await cb.expectASN1Sequence();
    const itemOID = await cb.readASN1OID();
    const itemName = DNOIDMap[itemOID] ?? itemOID;
    const valueType = await cb.readUint8();
    if (valueType === universalTypePrintableString) {
    } else if (valueType === universalTypeUTF8String) {
    } else if (valueType === universalTypeIA5String) {
    } else if (valueType === universalTypeTeletexString) {
    } else {
      throw new Error(`Unexpected item type in certificate ${seqType}: 0x${hexFromU8([valueType])}`);
    }
    const [endItemString, itemStringRemaining] = await cb.expectASN1Length(0);
    const itemValue = await cb.readUTF8String(itemStringRemaining());
    endItemString();
    endItemSeq();
    endItemSet();
    const existingValue = result[itemName];
    if (existingValue === void 0) result[itemName] = itemValue;
    else if (typeof existingValue === "string") result[itemName] = [existingValue, itemValue];
    else existingValue.push(itemValue);
  }
  endSeq();
  return result;
}
async function readNamesSeq(cb, typeUnionBits = 0) {
  const names = [];
  const [endNamesSeq, namesSeqRemaining] = await cb.expectASN1Sequence(0);
  while (namesSeqRemaining() > 0) {
    const type = await cb.readUint8(0);
    const [endName, nameRemaining] = await cb.expectASN1Length(0);
    let name;
    if (type === (typeUnionBits | 2 /* dNSName */)) {
      name = await cb.readUTF8String(nameRemaining());
    } else {
      name = await cb.readBytes(nameRemaining());
    }
    names.push({ name, type });
    endName();
  }
  endNamesSeq();
  return names;
}
function algorithmWithOID(oid) {
  const algo = {
    "1.2.840.113549.1.1.1": {
      name: "RSAES-PKCS1-v1_5"
    },
    "1.2.840.113549.1.1.5": {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.113549.1.1.11": {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-256"
      }
    },
    "1.2.840.113549.1.1.12": {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-384"
      }
    },
    "1.2.840.113549.1.1.13": {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-512"
      }
    },
    "1.2.840.113549.1.1.10": {
      name: "RSA-PSS"
    },
    "1.2.840.113549.1.1.7": {
      name: "RSA-OAEP"
    },
    "1.2.840.10045.2.1": {
      // dupes
      name: "ECDSA",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.10045.4.1": {
      // dupes
      name: "ECDSA",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.10045.4.3.2": {
      name: "ECDSA",
      hash: {
        name: "SHA-256"
      }
    },
    "1.2.840.10045.4.3.3": {
      name: "ECDSA",
      hash: {
        name: "SHA-384"
      }
    },
    "1.2.840.10045.4.3.4": {
      name: "ECDSA",
      hash: {
        name: "SHA-512"
      }
    },
    "1.3.133.16.840.63.0.2": {
      name: "ECDH",
      kdf: "SHA-1"
    },
    "1.3.132.1.11.1": {
      name: "ECDH",
      kdf: "SHA-256"
    },
    "1.3.132.1.11.2": {
      name: "ECDH",
      kdf: "SHA-384"
    },
    "1.3.132.1.11.3": {
      name: "ECDH",
      kdf: "SHA-512"
    },
    "2.16.840.1.101.3.4.1.2": {
      name: "AES-CBC",
      length: 128
    },
    "2.16.840.1.101.3.4.1.22": {
      name: "AES-CBC",
      length: 192
    },
    "2.16.840.1.101.3.4.1.42": {
      name: "AES-CBC",
      length: 256
    },
    "2.16.840.1.101.3.4.1.6": {
      name: "AES-GCM",
      length: 128
    },
    "2.16.840.1.101.3.4.1.26": {
      name: "AES-GCM",
      length: 192
    },
    "2.16.840.1.101.3.4.1.46": {
      name: "AES-GCM",
      length: 256
    },
    "2.16.840.1.101.3.4.1.4": {
      name: "AES-CFB",
      length: 128
    },
    "2.16.840.1.101.3.4.1.24": {
      name: "AES-CFB",
      length: 192
    },
    "2.16.840.1.101.3.4.1.44": {
      name: "AES-CFB",
      length: 256
    },
    "2.16.840.1.101.3.4.1.5": {
      name: "AES-KW",
      length: 128
    },
    "2.16.840.1.101.3.4.1.25": {
      name: "AES-KW",
      length: 192
    },
    "2.16.840.1.101.3.4.1.45": {
      name: "AES-KW",
      length: 256
    },
    "1.2.840.113549.2.7": {
      name: "HMAC",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.113549.2.9": {
      name: "HMAC",
      hash: {
        name: "SHA-256"
      }
    },
    "1.2.840.113549.2.10": {
      name: "HMAC",
      hash: {
        name: "SHA-384"
      }
    },
    "1.2.840.113549.2.11": {
      name: "HMAC",
      hash: {
        name: "SHA-512"
      }
    },
    "1.2.840.113549.1.9.16.3.5": {
      name: "DH"
    },
    "1.3.14.3.2.26": {
      name: "SHA-1"
    },
    "2.16.840.1.101.3.4.2.1": {
      name: "SHA-256"
    },
    "2.16.840.1.101.3.4.2.2": {
      name: "SHA-384"
    },
    "2.16.840.1.101.3.4.2.3": {
      name: "SHA-512"
    },
    "1.2.840.113549.1.5.12": {
      name: "PBKDF2"
    },
    // special case: OIDs for ECC curves
    "1.2.840.10045.3.1.7": {
      name: "P-256"
    },
    "1.3.132.0.34": {
      name: "P-384"
    },
    "1.3.132.0.35": {
      name: "P-521"
    }
  }[oid];
  if (algo === void 0) throw new Error(`Unsupported algorithm identifier: ${oid}`);
  return algo;
}
function _descriptionForAlgorithm(algo, desc = []) {
  Object.values(algo).forEach((value) => {
    if (typeof value === "string") desc = [...desc, value];
    else desc = _descriptionForAlgorithm(value, desc);
  });
  return desc;
}
function descriptionForAlgorithm(algo) {
  return _descriptionForAlgorithm(algo).join(" / ");
}

// src/util/asn1bytes.ts
var ASN1Bytes = class extends Bytes {
  async readASN1Length(comment) {
    const byte1 = await this.readUint8();
    if (byte1 < 128) {
      return byte1;
    }
    const lengthBytes = byte1 & 127;
    const fullComment = 0;
    if (lengthBytes === 1) return this.readUint8(fullComment);
    if (lengthBytes === 2) return this.readUint16(fullComment);
    if (lengthBytes === 3) return this.readUint24(fullComment);
    if (lengthBytes === 4) return this.readUint32(fullComment);
    throw new Error(`ASN.1 length fields are only supported up to 4 bytes (this one is ${lengthBytes} bytes)`);
  }
  async expectASN1Length(comment) {
    const length = await this.readASN1Length(comment);
    return this.expectReadLength(length);
  }
  async readASN1OID(comment) {
    await this.expectUint8(universalTypeOID, 0);
    const [endOID, OIDRemaining] = await this.expectASN1Length(0);
    const byte1 = await this.readUint8();
    let oid = `${Math.floor(byte1 / 40)}.${byte1 % 40}`;
    while (OIDRemaining() > 0) {
      let value = 0;
      while (true) {
        const nextByte = await this.readUint8();
        value <<= 7;
        value += nextByte & 127;
        if (nextByte < 128) break;
      }
      oid += `.${value}`;
    }
    endOID();
    return oid;
  }
  async readASN1Boolean(comment) {
    const [endBoolean, booleanRemaining] = await this.expectASN1Length(0);
    const length = booleanRemaining();
    if (length !== 1) throw new Error(`Boolean has weird length: ${length}`);
    const byte = await this.readUint8();
    let result;
    if (byte === 255) result = true;
    else if (byte === 0) result = false;
    else throw new Error(`Boolean has weird value: 0x${hexFromU8([byte])}`);
    if (0) this.comment(comment.replace(/%/g, String(result)));
    endBoolean();
    return result;
  }
  async readASN1UTCTime() {
    const [endTime, timeRemaining] = await this.expectASN1Length(0);
    const timeStr = await this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
    if (!parts) throw new Error("Unrecognised ASN.1 UTC time format");
    const [, yr2dstr, mth, dy, hr, min, sec] = parts;
    const yr2d = parseInt(yr2dstr, 10);
    const yr = yr2d + (yr2d >= 50 ? 1900 : 2e3);
    const time = /* @__PURE__ */ new Date(`${yr}-${mth}-${dy}T${hr}:${min}:${sec}Z`);
    endTime();
    return time;
  }
  async readASN1GeneralizedTime() {
    const [endTime, timeRemaining] = await this.expectASN1Length(0);
    const timeStr = await this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})?([0-9]{2})?([.][0-9]+)?(Z)?([-+][0-9]+)?$/);
    if (!parts) throw new Error("Unrecognised ASN.1 generalized time format");
    const [, yr, mth, dy, hr, min, sec, fracsec, z, tz] = parts;
    if (sec === void 0 && fracsec !== void 0) throw new Error("Invalid ASN.1 generalized time format (fraction\
 without seconds)");
    if (z !== void 0 && tz !== void 0) throw new Error("Invalid ASN.1 generalized time format (Z and timezone)");
    const time = /* @__PURE__ */ new Date(`${yr}-${mth}-${dy}T${hr}:${min ?? "00"}:${sec ?? "00"}${fracsec ?? ""}${tz ??
    "Z"}`);
    endTime();
    return time;
  }
  async readASN1BitString(comment) {
    await this.expectUint8(universalTypeBitString, 0);
    const [endBitString, bitStringRemaining] = await this.expectASN1Length(comment);
    const rightPadBits = await this.readUint8(0);
    const bytesLength = bitStringRemaining();
    const bitString = await this.readBytes(bytesLength);
    if (rightPadBits > 7) throw new Error(`Invalid right pad value: ${rightPadBits}`);
    if (rightPadBits > 0) {
      const leftPadNext = 8 - rightPadBits;
      for (let i = bytesLength - 1; i > 0; i--) {
        bitString[i] = 255 & bitString[i - 1] << leftPadNext | bitString[i] >>> rightPadBits;
      }
      bitString[0] = bitString[0] >>> rightPadBits;
    }
    endBitString();
    return bitString;
  }
  async expectASN1Sequence(comment) {
    await this.expectUint8(constructedUniversalTypeSequence, 0);
    return this.expectASN1Length(comment);
  }
  async expectASN1OctetString(comment) {
    await this.expectUint8(universalTypeOctetString, 0);
    return this.expectASN1Length(comment);
  }
  async expectASN1DERDoc() {
    return this.expectASN1OctetString(0);
  }
};

// src/presentation/log.ts
var appendLog = Symbol("append");

// src/presentation/highlights.ts
var regex = new RegExp(`  .+|^(${indentChars})+`, "gm");

// src/tls/sessionTicket.ts
async function parseSessionTicket(record) {
  if (0) {
    const ticket = new Bytes2(record);
    await ticket.expectUint8(4, "session ticket message, per [RFC 8846 \xA74.6.1](https://datatracker.ietf.org/do\
c/html/rfc8446#section-4.6.1) (we do nothing with these)");
    const [endTicketRecord] = await ticket.expectLengthUint24("session ticket message");
    const ticketSeconds = await ticket.readUint32();
    ticket.comment(`ticket lifetime in seconds: ${ticketSeconds} = ${ticketSeconds / 3600} hours`);
    await ticket.readUint32("ticket age add");
    const [endTicketNonce, ticketNonceRemaining] = await ticket.expectLengthUint8("ticket nonce");
    await ticket.readBytes(ticketNonceRemaining());
    ticket.comment("ticket nonce");
    endTicketNonce();
    const [endTicket, ticketRemaining] = await ticket.expectLengthUint16("ticket");
    await ticket.readBytes(ticketRemaining());
    ticket.comment("ticket");
    endTicket();
    const [endTicketExts, ticketExtsRemaining] = await ticket.expectLengthUint16("ticket extensions");
    if (ticketExtsRemaining() > 0) {
      await ticket.readBytes(ticketExtsRemaining());
      ticket.comment("ticket extensions (ignored)");
    }
    endTicketExts();
    endTicketRecord();
    log(...highlightBytes(ticket.commentedString(), LogColours.server));
  }
}

// src/util/readQueue.ts
var ReadMode = /* @__PURE__ */ ((ReadMode2) => {
  ReadMode2[ReadMode2["CONSUME"] = 0] = "CONSUME";
  ReadMode2[ReadMode2["PEEK"] = 1] = "PEEK";
  return ReadMode2;
})(ReadMode || {});
var ReadQueue = class {
  constructor() {
    __publicField(this, "queue");
    __publicField(this, "outstandingRequest");
    this.queue = [];
  }
  enqueue(data) {
    this.queue.push(data);
    this.dequeue();
  }
  dequeue() {
    if (this.outstandingRequest === void 0) return;
    const { resolve, bytes: requestedBytes, readMode } = this.outstandingRequest;
    const bytesInQueue = this.bytesInQueue();
    if (bytesInQueue < requestedBytes && this.moreDataMayFollow()) return;
    const bytes = Math.min(requestedBytes, bytesInQueue);
    if (bytes === 0) {
      resolve(void 0);
      return;
    }
    this.outstandingRequest = void 0;
    const firstItem = this.queue[0];
    const firstItemLength = firstItem.length;
    if (firstItemLength === bytes) {
      if (readMode === 0 /* CONSUME */) this.queue.shift();
      resolve(firstItem);
      return;
    }
    if (firstItemLength > bytes) {
      if (readMode === 0 /* CONSUME */) this.queue[0] = firstItem.subarray(bytes);
      resolve(firstItem.subarray(0, bytes));
      return;
    }
    const result = new Uint8Array(bytes);
    let outstandingBytes = bytes;
    let offset = 0;
    let itemsConsumed = 0;
    while (outstandingBytes > 0) {
      const nextItem = this.queue[itemsConsumed];
      const nextItemLength = nextItem.length;
      if (nextItemLength <= outstandingBytes) {
        itemsConsumed++;
        result.set(nextItem, offset);
        offset += nextItemLength;
        outstandingBytes -= nextItemLength;
      } else {
        if (readMode === 0 /* CONSUME */) this.queue[itemsConsumed] = nextItem.subarray(outstandingBytes);
        result.set(nextItem.subarray(0, outstandingBytes), offset);
        outstandingBytes -= outstandingBytes;
        offset += outstandingBytes;
      }
    }
    if (readMode === 0 /* CONSUME */) this.queue.splice(0, itemsConsumed);
    resolve(result);
  }
  bytesInQueue() {
    return this.queue.reduce((memo, arr) => memo + arr.length, 0);
  }
  async read(bytes, readMode = 0 /* CONSUME */) {
    if (this.outstandingRequest !== void 0) throw new Error("Can\u2019t read while already awaiting read");
    return new Promise((resolve) => {
      this.outstandingRequest = { resolve, bytes, readMode };
      this.dequeue();
    });
  }
};
var WebSocketReadQueue = class extends ReadQueue {
  constructor(socket) {
    super();
    this.socket = socket;
    socket.addEventListener("message", (msg) => this.enqueue(new Uint8Array(msg.data)));
    socket.addEventListener("close", () => this.dequeue());
  }
  moreDataMayFollow() {
    const { socket } = this;
    const { readyState } = socket;
    const connecting = readyState === 0 /* CONNECTING */;
    const open = readyState === 1 /* OPEN */;
    return connecting || open;
  }
};
var SocketReadQueue = class extends ReadQueue {
  constructor(socket) {
    super();
    this.socket = socket;
    socket.on("data", (data) => this.enqueue(new Uint8Array(data)));
    socket.on("close", () => this.dequeue());
  }
  moreDataMayFollow() {
    const { socket } = this;
    const { readyState } = socket;
    return readyState === "opening" || readyState === "open";
  }
};
var LazyReadFunctionReadQueue = class extends ReadQueue {
  constructor(readFn) {
    super();
    this.readFn = readFn;
    __publicField(this, "dataIsExhausted", false);
  }
  async read(bytes, readMode = 0 /* CONSUME */) {
    while (this.bytesInQueue() < bytes) {
      const data = await this.readFn();
      if (data === void 0) {
        this.dataIsExhausted = true;
        break;
      }
      if (data.length > 0) this.enqueue(data);
    }
    return super.read(bytes, readMode);
  }
  moreDataMayFollow() {
    return !this.dataIsExhausted;
  }
};

// src/tls/tlsRecord.ts
var RecordTypeName = {
  [20 /* ChangeCipherSpec */]: "ChangeCipherSpec",
  [21 /* Alert */]: "Alert",
  [22 /* Handshake */]: "Handshake",
  [23 /* Application */]: "Application",
  [24 /* Heartbeat */]: "Heartbeat"
};
var maxPlaintextRecordLength = 1 << 14;
var maxCiphertextRecordLength = maxPlaintextRecordLength + 1 + 255;
async function readTlsRecord(read, expectedType, maxLength = maxPlaintextRecordLength) {
  const nextByte = await read(1, 1 /* PEEK */);
  if (nextByte === void 0) return;
  const record = new Bytes(read);
  const type = await record.readUint8();
  if (!(type in RecordTypeName)) throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  await record.expectUint16(771, "TLS record version 1.2 (middlebox compatibility)");
  const [, recordRemaining] = await record.expectLengthUint16("TLS record");
  const length = recordRemaining();
  if (length > maxLength) throw new Error(`Record too long: ${length} bytes`);
  let alertLevel;
  if (type === 21 /* Alert */) {
    alertLevel = await record.readUint8(0);
    const desc = await record.readUint8(0);
  }
  if (alertLevel === 2) throw new Error("Fatal alert message received");
  else if (alertLevel === 1) return readTlsRecord(read, expectedType, maxLength);
  if (expectedType !== void 0 && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(
  16).padStart(2, "0")} (expected 0x${expectedType.toString(16).padStart(2, "0")})`);
  const rawHeader = record.array();
  const content = await record.subarrayForRead(length);
  return { type, length, content, rawHeader };
}
function bytesFromTlsRecords(read, expectedType) {
  const readQueue = new LazyReadFunctionReadQueue(async () => {
    const record = await readTlsRecord(read, expectedType);
    return record?.content;
  });
  const bytes = new ASN1Bytes(readQueue.read.bind(readQueue), 1);
  return bytes;
}
async function readEncryptedTlsRecord(read, decrypter, expectedType) {
  const encryptedRecord = await readTlsRecord(read, 23 /* Application */, maxCiphertextRecordLength);
  if (encryptedRecord === void 0) return;
  const encryptedBytes = new Bytes(encryptedRecord.content, 1);
  await encryptedBytes.skipRead(encryptedRecord.length - 16, 0);
  await encryptedBytes.skipRead(16, 0);
  const decryptedRecord = await decrypter.process(encryptedRecord.content, 16, encryptedRecord.rawHeader);
  let recordTypeIndex = decryptedRecord.length - 1;
  while (decryptedRecord[recordTypeIndex] === 0) recordTypeIndex -= 1;
  if (recordTypeIndex < 0) throw new Error("Decrypted message has no record type indicator (all zeroes)");
  const type = decryptedRecord[recordTypeIndex];
  const record = decryptedRecord.subarray(
    0,
    recordTypeIndex
    /* exclusive */
  );
  if (type === 21 /* Alert */) {
    const closeNotify = record.length === 2 && record[0] === 1 && record[1] === 0;
    if (closeNotify) return void 0;
  }
  if (type === 22 /* Handshake */ && record[0] === 4) {
    await parseSessionTicket(record);
    return readEncryptedTlsRecord(read, decrypter, expectedType);
  }
  if (expectedType !== void 0 && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(
  16).padStart(2, "0")} (expected 0x${expectedType.toString(16).padStart(2, "0")})`);
  return record;
}
function bytesFromEncryptedTlsRecords(read, decrypter, expectedType) {
  const readQueue = new LazyReadFunctionReadQueue(async () => {
    const record = await readEncryptedTlsRecord(read, decrypter, expectedType);
    return record;
  });
  const bytes = new ASN1Bytes(readQueue.read.bind(readQueue));
  return bytes;
}
async function makeEncryptedTlsRecord(plaintext, encrypter, type) {
  const data = concat(plaintext, [type]);
  const headerLength = 5;
  const dataLength = data.length;
  const authTagLength = 16;
  const payloadLength = dataLength + authTagLength;
  const encryptedRecord = new Bytes(headerLength + payloadLength);
  encryptedRecord.writeUint8(23, 0);
  encryptedRecord.writeUint16(771, 0);
  encryptedRecord.writeUint16(payloadLength, `${payloadLength} bytes follow`);
  const [endEncryptedRecord] = encryptedRecord.expectWriteLength(payloadLength);
  const header = encryptedRecord.array();
  const encryptedData = await encrypter.process(data, 16, header);
  encryptedRecord.writeBytes(encryptedData.subarray(0, encryptedData.length - 16));
  encryptedRecord.writeBytes(encryptedData.subarray(encryptedData.length - 16));
  endEncryptedRecord();
  return encryptedRecord.array();
}
async function makeEncryptedTlsRecords(plaintext, encrypter, type) {
  const recordCount = Math.ceil(plaintext.length / maxPlaintextRecordLength);
  const encryptedRecords = [];
  for (let i = 0; i < recordCount; i++) {
    const data = plaintext.subarray(i * maxPlaintextRecordLength, (i + 1) * maxPlaintextRecordLength);
    const encryptedRecord = await makeEncryptedTlsRecord(data, encrypter, type);
    encryptedRecords.push(encryptedRecord);
  }
  return encryptedRecords;
}

// src/util/cryptoProxy.ts
var subtleCrypto = typeof crypto !== "undefined" && crypto.subtle !== void 0 ? Promise.resolve(crypto.subtle) :
(
  // browsers and Node 19+
  import("crypto").then((c) => c.webcrypto.subtle)
);
function subtleCryptoMethod(method, args) {
  return subtleCrypto.then((cs) => cs[method](...args));
}
var cryptoProxy_default = new Proxy({}, {
  get(target, property) {
    return (...args) => subtleCryptoMethod(property, args);
  }
});

// src/tls/hkdf.ts
var txtEnc2 = new TextEncoder();
async function hkdfExtract(salt, keyMaterial, hashBits) {
  const hmacKey = await cryptoProxy_default.importKey("raw", salt, { name: "HMAC", hash: { name: `SHA-${hashBits}` } },
  false, ["sign"]);
  const prk = new Uint8Array(await cryptoProxy_default.sign("HMAC", hmacKey, keyMaterial));
  return prk;
}
async function hkdfExpand(key, info, length, hashBits) {
  const hashBytes = hashBits >> 3;
  const n = Math.ceil(length / hashBytes);
  const okm = new Uint8Array(n * hashBytes);
  const hmacKey = await cryptoProxy_default.importKey("raw", key, { name: "HMAC", hash: { name: `SHA-${hashBits}` } },
  false, ["sign"]);
  let tPrev = new Uint8Array(0);
  for (let i = 0; i < n; i++) {
    const hmacData = concat(tPrev, info, [i + 1]);
    const tiBuffer = await cryptoProxy_default.sign("HMAC", hmacKey, hmacData);
    const ti = new Uint8Array(tiBuffer);
    okm.set(ti, hashBytes * i);
    tPrev = ti;
  }
  return okm.subarray(0, length);
}
var tls13_Bytes = txtEnc2.encode("tls13 ");
async function hkdfExpandLabel(key, label, context, length, hashBits) {
  const labelData = txtEnc2.encode(label);
  const hkdfLabel = concat(
    [(length & 65280) >> 8, length & 255],
    [tls13_Bytes.length + labelData.length],
    tls13_Bytes,
    labelData,
    [context.length],
    context
  );
  return hkdfExpand(key, hkdfLabel, length, hashBits);
}

// src/tls/keys.ts
async function getHandshakeKeys(serverPublicKey, privateKey, hellos, hashBits, keyLength) {
  const hashBytes = hashBits >>> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const publicKey = await cryptoProxy_default.importKey("raw", serverPublicKey, { name: "ECDH", namedCurve: "P\
-256" }, false, []);
  const sharedSecretBuffer = await cryptoProxy_default.deriveBits({ name: "ECDH", public: publicKey }, privateKey,
  256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  const hellosHashBuffer = await cryptoProxy_default.digest("SHA-256", hellos);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashBits);
  const emptyHashBuffer = await cryptoProxy_default.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  const derivedSecret = await hkdfExpandLabel(earlySecret, "derived", emptyHash, hashBytes, hashBits);
  const handshakeSecret = await hkdfExtract(derivedSecret, sharedSecret, hashBits);
  const clientSecret = await hkdfExpandLabel(handshakeSecret, "c hs traffic", hellosHash, hashBytes, hashBits);
  const serverSecret = await hkdfExpandLabel(handshakeSecret, "s hs traffic", hellosHash, hashBytes, hashBits);
  const clientHandshakeKey = await hkdfExpandLabel(clientSecret, "key", new Uint8Array(0), keyLength, hashBits);
  const serverHandshakeKey = await hkdfExpandLabel(serverSecret, "key", new Uint8Array(0), keyLength, hashBits);
  const clientHandshakeIV = await hkdfExpandLabel(clientSecret, "iv", new Uint8Array(0), 12, hashBits);
  const serverHandshakeIV = await hkdfExpandLabel(serverSecret, "iv", new Uint8Array(0), 12, hashBits);
  return { serverHandshakeKey, serverHandshakeIV, clientHandshakeKey, clientHandshakeIV, handshakeSecret, clientSecret,
  serverSecret };
}
async function getApplicationKeys(handshakeSecret, handshakeHash, hashBits, keyLength) {
  const hashBytes = hashBits >>> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const emptyHashBuffer = await cryptoProxy_default.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  const derivedSecret = await hkdfExpandLabel(handshakeSecret, "derived", emptyHash, hashBytes, hashBits);
  const masterSecret = await hkdfExtract(derivedSecret, zeroKey, hashBits);
  const clientSecret = await hkdfExpandLabel(masterSecret, "c ap traffic", handshakeHash, hashBytes, hashBits);
  const serverSecret = await hkdfExpandLabel(masterSecret, "s ap traffic", handshakeHash, hashBytes, hashBits);
  const clientApplicationKey = await hkdfExpandLabel(clientSecret, "key", new Uint8Array(0), keyLength, hashBits);
  const serverApplicationKey = await hkdfExpandLabel(serverSecret, "key", new Uint8Array(0), keyLength, hashBits);
  const clientApplicationIV = await hkdfExpandLabel(clientSecret, "iv", new Uint8Array(0), 12, hashBits);
  const serverApplicationIV = await hkdfExpandLabel(serverSecret, "iv", new Uint8Array(0), 12, hashBits);
  return { serverApplicationKey, serverApplicationIV, clientApplicationKey, clientApplicationIV };
}

// src/tls/aesgcm.ts
var Crypter = class {
  constructor(mode, key, initialIv) {
    this.mode = mode;
    this.key = key;
    this.initialIv = initialIv;
    __publicField(this, "recordsProcessed", 0n);
    __publicField(this, "priorPromise", Promise.resolve(new Uint8Array()));
  }
  // The `Promise`s returned by successive calls to this function always resolve in sequence,
  // which is not true for `processUnsequenced` in Node (even if it seems to be in browsers)
  async process(data, authTagLength, additionalData) {
    return this.sequence(this.processUnsequenced(data, authTagLength, additionalData));
  }
  async sequence(promise) {
    const sequenced = this.priorPromise.then(() => promise);
    this.priorPromise = sequenced;
    return sequenced;
  }
  // data is plainText for encrypt, concat(ciphertext, authTag) for decrypt
  async processUnsequenced(data, authTagByteLength, additionalData) {
    const recordIndex = this.recordsProcessed;
    this.recordsProcessed += 1n;
    const iv = this.initialIv.slice();
    const ivLength = BigInt(iv.length);
    const lastIndex = ivLength - 1n;
    for (let i = 0n; i < ivLength; i++) {
      const shifted = recordIndex >> (i << 3n);
      if (shifted === 0n) break;
      iv[Number(lastIndex - i)] ^= Number(shifted & 0xffn);
    }
    const authTagBitLength = authTagByteLength << 3;
    const algorithm = { name: "AES-GCM", iv, tagLength: authTagBitLength, additionalData };
    const resultBuffer = await cryptoProxy_default[this.mode](algorithm, this.key, data);
    const result = new Uint8Array(resultBuffer);
    return result;
  }
};

// src/tls/cert.ts
var allKeyUsages = [
  // https://www.rfc-editor.org/rfc/rfc3280#section-4.2.1.3
  "digitalSignature",
  // (0)
  "nonRepudiation",
  // (1)
  "keyEncipherment",
  // (2)
  "dataEncipherment",
  // (3)
  "keyAgreement",
  // (4)
  "keyCertSign",
  // (5)
  "cRLSign",
  // (6)
  "encipherOnly",
  // (7)
  "decipherOnly"
  // (8)
];
var Cert = class _Cert {
  constructor() {
    __publicField(this, "serialNumber");
    __publicField(this, "algorithm");
    __publicField(this, "issuer");
    __publicField(this, "validityPeriod");
    __publicField(this, "subject");
    __publicField(this, "publicKey");
    __publicField(this, "signature");
    __publicField(this, "keyUsage");
    __publicField(this, "subjectAltNames");
    __publicField(this, "extKeyUsage");
    __publicField(this, "authorityKeyIdentifier");
    __publicField(this, "subjectKeyIdentifier");
    __publicField(this, "basicConstraints");
    // nameConstraints?: { critical?: boolean; permitted?: string[]; excluded?: string[] };
    __publicField(this, "signedData");
    __publicField(this, "rawData");
    throw new Error("Use `await Cert.create(...)`, not `new Cert(...)`");
  }
  static distinguishedNamesAreEqual(dn1, dn2) {
    return this.stringFromDistinguishedName(dn1) === this.stringFromDistinguishedName(dn2);
  }
  static stringFromDistinguishedName(dn) {
    return Object.entries(dn).map(
      ([k, vs]) => typeof vs === "string" ? `${k}=${vs.trim().replace(/[\\,]/g, "\\$&")}` : vs.map((v) => `${k}\
=${v.trim().replace(/[\\,]/g, "\\$&")}`).join(", ")
    ).join(", ");
  }
  static async create(certData) {
    const cert = Object.create(this.prototype);
    if (certData instanceof ASN1Bytes || certData instanceof Uint8Array) {
      const cb = certData instanceof ASN1Bytes ? certData : new ASN1Bytes(certData);
      const certSeqStartOffset = cb.offset;
      const [endCertSeq] = await cb.expectASN1Sequence(0);
      const tbsCertStartOffset = cb.offset;
      const [endCertInfoSeq] = await cb.expectASN1Sequence(0);
      await cb.expectBytes([160, 3, 2, 1, 2], 0);
      await cb.expectUint8(universalTypeInteger, 0);
      const [endSerialNumber, serialNumberRemaining] = await cb.expectASN1Length(0);
      cert.serialNumber = await cb.subarrayForRead(serialNumberRemaining());
      endSerialNumber();
      const [endAlgo, algoRemaining] = await cb.expectASN1Sequence(0);
      cert.algorithm = await cb.readASN1OID();
      if (algoRemaining() > 0) {
        await cb.expectUint8(universalTypeNull, 0);
        await cb.expectUint8(0, 0);
      }
      endAlgo();
      cert.issuer = await readSeqOfSetOfSeq(cb, 0);
      let notBefore, notAfter;
      const [endValiditySeq] = await cb.expectASN1Sequence(0);
      const startTimeType = await cb.readUint8();
      if (startTimeType === universalTypeUTCTime) {
        notBefore = await cb.readASN1UTCTime();
      } else if (startTimeType === universalTypeGeneralizedTime) {
        notBefore = await cb.readASN1GeneralizedTime();
      } else {
        throw new Error(`Unexpected validity start type 0x${hexFromU8([startTimeType])}`);
      }
      const endTimeType = await cb.readUint8();
      if (endTimeType === universalTypeUTCTime) {
        notAfter = await cb.readASN1UTCTime();
      } else if (endTimeType === universalTypeGeneralizedTime) {
        notAfter = await cb.readASN1GeneralizedTime();
      } else {
        throw new Error(`Unexpected validity end type 0x${hexFromU8([endTimeType])}`);
      }
      cert.validityPeriod = { notBefore, notAfter };
      endValiditySeq();
      cert.subject = await readSeqOfSetOfSeq(cb, 0);
      const publicKeyStartOffset = cb.offset;
      const [endPublicKeySeq] = await cb.expectASN1Sequence(0);
      const [endKeyOID, keyOIDRemaining] = await cb.expectASN1Sequence(0);
      const publicKeyOIDs = [];
      while (keyOIDRemaining() > 0) {
        const keyParamRecordType = await cb.readUint8();
        if (keyParamRecordType === universalTypeOID) {
          cb.offset--;
          const keyOID = await cb.readASN1OID();
          publicKeyOIDs.push(keyOID);
        } else if (keyParamRecordType === universalTypeNull) {
          await cb.expectUint8(0, 0);
        }
      }
      endKeyOID();
      const publicKeyData = await cb.readASN1BitString();
      cert.publicKey = { identifiers: publicKeyOIDs, data: publicKeyData, all: cb.data.subarray(publicKeyStartOffset,
      cb.offset) };
      endPublicKeySeq();
      await cb.expectUint8(constructedContextSpecificType, 0);
      const [endExtsData] = await cb.expectASN1Length();
      const [endExts, extsRemaining] = await cb.expectASN1Sequence(0);
      while (extsRemaining() > 0) {
        const [endExt, extRemaining] = await cb.expectASN1Sequence(0);
        const extOID = await cb.readASN1OID("extension type");
        if (extOID === "2.5.29.17") {
          const [endSanDerDoc] = await cb.expectASN1DERDoc();
          const allSubjectAltNames = await readNamesSeq(cb, contextSpecificType);
          cert.subjectAltNames = allSubjectAltNames.filter((san) => san.type === (2 /* dNSName */ | contextSpecificType)).
          map((san) => san.name);
          endSanDerDoc();
        } else if (extOID === "2.5.29.15") {
          let keyUsageCritical;
          let nextType = await cb.readUint8();
          if (nextType === universalTypeBoolean) {
            keyUsageCritical = await cb.readASN1Boolean(0);
            nextType = await cb.readUint8();
          }
          cb.offset--;
          const [endKeyUsageDer] = await cb.expectASN1DERDoc();
          const keyUsageBitStr = await cb.readASN1BitString();
          const keyUsageBitmask = intFromBitString(keyUsageBitStr);
          const keyUsageNames = new Set(allKeyUsages.filter((u, i) => keyUsageBitmask & 1 << i));
          endKeyUsageDer();
          cert.keyUsage = {
            critical: keyUsageCritical,
            usages: keyUsageNames
          };
        } else if (extOID === "2.5.29.37") {
          cert.extKeyUsage = {};
          const [endExtKeyUsageDer] = await cb.expectASN1DERDoc();
          const [endExtKeyUsage, extKeyUsageRemaining] = await cb.expectASN1Sequence(0);
          while (extKeyUsageRemaining() > 0) {
            const extKeyUsageOID = await cb.readASN1OID();
            if (extKeyUsageOID === "1.3.6.1.5.5.7.3.1") cert.extKeyUsage.serverTls = true;
            if (extKeyUsageOID === "1.3.6.1.5.5.7.3.2") cert.extKeyUsage.clientTls = true;
          }
          endExtKeyUsage();
          endExtKeyUsageDer();
        } else if (extOID === "2.5.29.35") {
          const [endAuthKeyIdDer] = await cb.expectASN1DERDoc();
          const [endAuthKeyIdSeq, authKeyIdSeqRemaining] = await cb.expectASN1Sequence();
          while (authKeyIdSeqRemaining() > 0) {
            const authKeyIdDatumType = await cb.readUint8();
            if (authKeyIdDatumType === (contextSpecificType | 0)) {
              const [endAuthKeyId, authKeyIdRemaining] = await cb.expectASN1Length(0);
              cert.authorityKeyIdentifier = await cb.readBytes(authKeyIdRemaining());
              endAuthKeyId();
            } else if (authKeyIdDatumType === (contextSpecificType | 1)) {
              const [endAuthKeyIdCertIssuer, authKeyIdCertIssuerRemaining] = await cb.expectASN1Length(0);
              await cb.skipRead(authKeyIdCertIssuerRemaining(), 0);
              endAuthKeyIdCertIssuer();
            } else if (authKeyIdDatumType === (contextSpecificType | 2)) {
              const [endAuthKeyIdCertSerialNo, authKeyIdCertSerialNoRemaining] = await cb.expectASN1Length(0);
              await cb.skipRead(authKeyIdCertSerialNoRemaining(), 0);
              endAuthKeyIdCertSerialNo();
            } else if (authKeyIdDatumType === (contextSpecificType | 33)) {
              const [endDirName, dirNameRemaining] = await cb.expectASN1Length(0);
              await cb.skipRead(dirNameRemaining(), 0);
              endDirName();
            } else {
              throw new Error(`Unexpected data type ${authKeyIdDatumType} in authorityKeyIdentifier certificat\
e extension`);
            }
          }
          endAuthKeyIdSeq();
          endAuthKeyIdDer();
        } else if (extOID === "2.5.29.14") {
          const [endSubjectKeyIdDer] = await cb.expectASN1DERDoc();
          const [endSubjectKeyId, subjectKeyIdRemaining] = await cb.expectASN1OctetString("subject key identif\
ier");
          cert.subjectKeyIdentifier = await cb.readBytes(subjectKeyIdRemaining());
          endSubjectKeyId();
          endSubjectKeyIdDer();
        } else if (extOID === "2.5.29.19") {
          let basicConstraintsCritical;
          let bcNextType = await cb.readUint8();
          if (bcNextType === universalTypeBoolean) {
            basicConstraintsCritical = await cb.readASN1Boolean(0);
            bcNextType = await cb.readUint8();
          }
          cb.offset--;
          const [endBasicConstraintsDer] = await cb.expectASN1DERDoc();
          const [endConstraintsSeq, constraintsSeqRemaining] = await cb.expectASN1Sequence();
          let basicConstraintsCa = void 0;
          if (constraintsSeqRemaining() > 0) {
            await cb.expectUint8(universalTypeBoolean, 0);
            basicConstraintsCa = await cb.readASN1Boolean(0);
          }
          let basicConstraintsPathLength;
          if (constraintsSeqRemaining() > 0) {
            await cb.expectUint8(universalTypeInteger, 0);
            const maxPathLengthLength = await cb.readASN1Length(0);
            basicConstraintsPathLength = maxPathLengthLength === 1 ? await cb.readUint8() : maxPathLengthLength ===
            2 ? await cb.readUint16() : maxPathLengthLength === 3 ? await cb.readUint24() : void 0;
            if (basicConstraintsPathLength === void 0) throw new Error("Too many bytes in max path length in c\
ertificate basicConstraints");
          }
          endConstraintsSeq();
          endBasicConstraintsDer();
          cert.basicConstraints = {
            critical: basicConstraintsCritical,
            ca: basicConstraintsCa,
            pathLength: basicConstraintsPathLength
          };
        } else if (0) {
          const [endAuthInfoAccessDER] = await cb.expectASN1DERDoc();
          const [endAuthInfoAccessSeq, authInfoAccessSeqRemaining] = await cb.expectASN1Sequence();
          while (authInfoAccessSeqRemaining() > 0) {
            const [endAuthInfoAccessInnerSeq] = await cb.expectASN1Sequence();
            const accessMethodOID = await cb.readASN1OID();
            await cb.expectUint8(contextSpecificType | 6 /* uniformResourceIdentifier */, 0);
            const [endMethodURI, methodURIRemaining] = await cb.expectASN1Length(0);
            await cb.readUTF8String(methodURIRemaining());
            endMethodURI();
            endAuthInfoAccessInnerSeq();
          }
          endAuthInfoAccessSeq();
          endAuthInfoAccessDER();
        } else if (0) {
          const [endCertPolDER] = await cb.expectASN1DERDoc();
          const [endCertPolSeq, certPolSeqRemaining] = await cb.expectASN1Sequence();
          while (certPolSeqRemaining() > 0) {
            const [endCertPolInnerSeq, certPolInnerSeqRemaining] = await cb.expectASN1Sequence();
            const certPolOID = await cb.readASN1OID("CertPolicyID");
            while (certPolInnerSeqRemaining() > 0) {
              const [endCertPolInner2Seq, certPolInner2SeqRemaining] = await cb.expectASN1Sequence();
              while (certPolInner2SeqRemaining() > 0) {
                const [endCertPolInner3Seq, certPolInner3SeqRemaining] = await cb.expectASN1Sequence();
                const certPolQualOID = await cb.readASN1OID("policyQualifierId");
                const qualType = await cb.readUint8();
                if (0) {
                  cb.comment("IA5String");
                  const [endQualStr, qualStrRemaining] = await cb.expectASN1Length("string");
                  await cb.readUTF8String(qualStrRemaining());
                  endQualStr();
                } else {
                  if (certPolInner3SeqRemaining()) await cb.skipRead(certPolInner3SeqRemaining(), "skipped pol\
icy qualifier data");
                }
                endCertPolInner3Seq();
              }
              endCertPolInner2Seq();
            }
            endCertPolInnerSeq();
          }
          endCertPolSeq();
          endCertPolDER();
        } else {
          await cb.skipRead(extRemaining(), 0);
        }
        endExt();
      }
      endExts();
      endExtsData();
      endCertInfoSeq();
      cert.signedData = cb.data.subarray(tbsCertStartOffset, cb.offset);
      const [endSigAlgo, sigAlgoRemaining] = await cb.expectASN1Sequence(0);
      const sigAlgoOID = await cb.readASN1OID(0);
      if (sigAlgoRemaining() > 0) {
        await cb.expectUint8(universalTypeNull, 0);
        await cb.expectUint8(0, 0);
      }
      endSigAlgo();
      if (sigAlgoOID !== cert.algorithm) throw new Error(`Certificate specifies different signature algorithms\
 inside (${cert.algorithm}) and out (${sigAlgoOID})`);
      cert.signature = await cb.readASN1BitString(0);
      endCertSeq();
      cert.rawData = cb.data.subarray(certSeqStartOffset, cb.offset);
    } else {
      cert.serialNumber = u8FromHex(certData.serialNumber);
      cert.algorithm = certData.algorithm;
      cert.issuer = certData.issuer;
      cert.validityPeriod = {
        notBefore: new Date(certData.validityPeriod.notBefore),
        notAfter: new Date(certData.validityPeriod.notAfter)
      };
      cert.subject = certData.subject;
      cert.publicKey = {
        identifiers: certData.publicKey.identifiers,
        data: u8FromHex(certData.publicKey.data),
        all: u8FromHex(certData.publicKey.all)
      };
      cert.signature = u8FromHex(certData.signature);
      cert.keyUsage = {
        critical: certData.keyUsage.critical,
        usages: new Set(certData.keyUsage.usages)
      };
      cert.subjectAltNames = certData.subjectAltNames;
      cert.extKeyUsage = certData.extKeyUsage;
      if (certData.authorityKeyIdentifier) cert.authorityKeyIdentifier = u8FromHex(certData.authorityKeyIdentifier);
      if (certData.subjectKeyIdentifier) cert.subjectKeyIdentifier = u8FromHex(certData.subjectKeyIdentifier);
      cert.basicConstraints = certData.basicConstraints;
      cert.signedData = u8FromHex(certData.signedData);
      cert.rawData = u8FromHex(certData.rawData);
    }
    return cert;
  }
  subjectAltNameMatchingHost(host) {
    const twoDotRegex = /[.][^.]+[.][^.]+$/;
    return (this.subjectAltNames ?? []).find((cert) => {
      let certName = cert;
      let hostName = host;
      if (twoDotRegex.test(host) && twoDotRegex.test(certName) && certName.startsWith("*.")) {
        certName = certName.slice(1);
        hostName = hostName.slice(hostName.indexOf("."));
      }
      if (certName === hostName) return true;
    });
  }
  isValidAtMoment(moment = /* @__PURE__ */ new Date()) {
    return moment >= this.validityPeriod.notBefore && moment <= this.validityPeriod.notAfter;
  }
  description() {
    return "subject: " + _Cert.stringFromDistinguishedName(this.subject) + (this.subjectAltNames ? "\nsubject a\
lt names: " + this.subjectAltNames.join(", ") : "") + (this.subjectKeyIdentifier ? `
subject key id: ${hexFromU8(this.subjectKeyIdentifier)}` : "") + "\nissuer: " + _Cert.stringFromDistinguishedName(
    this.issuer) + (this.authorityKeyIdentifier ? `
authority key id: ${hexFromU8(this.authorityKeyIdentifier)}` : "") + "\nvalidity: " + this.validityPeriod.notBefore.
    toISOString() + " \u2014 " + this.validityPeriod.notAfter.toISOString() + ` (${this.isValidAtMoment() ? "c\
urrently valid" : "not valid"})` + (this.keyUsage ? `
key usage (${this.keyUsage.critical ? "critical" : "non-critical"}): ` + [...this.keyUsage.usages].join(", ") :
    "") + (this.extKeyUsage ? `
extended key usage: TLS server \u2014 ${this.extKeyUsage.serverTls}, TLS client \u2014 ${this.extKeyUsage.clientTls}` :
    "") + (this.basicConstraints ? `
basic constraints (${this.basicConstraints.critical ? "critical" : "non-critical"}): CA \u2014 ${this.basicConstraints.
    ca}, path length \u2014 ${this.basicConstraints.pathLength}` : "") + "\nsignature algorithm: " + descriptionForAlgorithm(
    algorithmWithOID(this.algorithm));
  }
  toJSON() {
    return {
      serialNumber: hexFromU8(this.serialNumber),
      algorithm: this.algorithm,
      issuer: this.issuer,
      validityPeriod: {
        notBefore: this.validityPeriod.notBefore.toISOString(),
        notAfter: this.validityPeriod.notAfter.toISOString()
      },
      subject: this.subject,
      publicKey: {
        identifiers: this.publicKey.identifiers,
        data: hexFromU8(this.publicKey.data),
        all: hexFromU8(this.publicKey.all)
      },
      signature: hexFromU8(this.signature),
      keyUsage: {
        critical: this.keyUsage?.critical,
        usages: [...this.keyUsage?.usages ?? []]
      },
      subjectAltNames: this.subjectAltNames,
      extKeyUsage: this.extKeyUsage,
      authorityKeyIdentifier: this.authorityKeyIdentifier && hexFromU8(this.authorityKeyIdentifier),
      subjectKeyIdentifier: this.subjectKeyIdentifier && hexFromU8(this.subjectKeyIdentifier),
      basicConstraints: this.basicConstraints,
      signedData: hexFromU8(this.signedData),
      rawData: hexFromU8(this.rawData)
    };
  }
  static uint8ArraysFromPEM(pem) {
    const tag = "[A-Z0-9 ]+";
    const pattern = new RegExp(`-----BEGIN ${tag}-----([a-zA-Z0-9=+\\/\\n\\r]+)-----END ${tag}-----`, "g");
    const res = [];
    let matches = null;
    while (matches = pattern.exec(pem)) {
      const base64 = matches[1].replace(/[\r\n]/g, "");
      const binary = fromBase64(base64);
      res.push(binary);
    }
    return res;
  }
  static fromPEM(pem) {
    return Promise.all(this.uint8ArraysFromPEM(pem).map((arr) => this.create(arr)));
  }
};
var TrustedCert = class extends Cert {
  static async databaseFromPEM(pem) {
    const certsData = this.uint8ArraysFromPEM(pem);
    const offsets = [0];
    const subjects = {};
    const growable = new GrowableData();
    for (const certData of certsData) {
      const cert = await this.create(certData);
      const offsetIndex = offsets.length - 1;
      if (cert.subjectKeyIdentifier) subjects[hexFromU8(cert.subjectKeyIdentifier)] = offsetIndex;
      subjects[this.stringFromDistinguishedName(cert.subject)] = offsetIndex;
      growable.append(certData);
      offsets[offsets.length] = offsets[offsetIndex] + certData.length;
    }
    const data = growable.getData();
    return { index: { offsets, subjects }, data };
  }
  static async findInDatabase(subjectOrSubjectKeyId, db) {
    const { index: { subjects, offsets }, data } = db;
    const key = typeof subjectOrSubjectKeyId === "string" ? subjectOrSubjectKeyId : Cert.stringFromDistinguishedName(
    subjectOrSubjectKeyId);
    const offsetIndex = subjects[key];
    if (offsetIndex === void 0) return;
    const start = offsets[offsetIndex];
    const end = offsets[offsetIndex + 1];
    const certData = data.subarray(start, end);
    const cert = await this.create(certData);
    return cert;
  }
};

// src/tls/ecdsa.ts
async function ecdsaVerify(sb, publicKey, signedData, namedCurve, hash) {
  const [endSigDer] = await sb.expectASN1Sequence();
  await sb.expectUint8(universalTypeInteger, 0);
  const [endSigRBytes, sigRBytesRemaining] = await sb.expectASN1Length(0);
  const sigR = await sb.readBytes(sigRBytesRemaining());
  endSigRBytes();
  await sb.expectUint8(universalTypeInteger, 0);
  const [endSigSBytes, sigSBytesRemaining] = await sb.expectASN1Length(0);
  const sigS = await sb.readBytes(sigSBytesRemaining());
  endSigSBytes();
  endSigDer();
  const clampToLength = (x, clampLength) => x.length > clampLength ? x.subarray(x.length - clampLength) : (
    // too long? cut off leftmost bytes (msb)
    x.length < clampLength ? concat(new Uint8Array(clampLength - x.length), x) : (
      // too short? left pad with zeroes
      x
    )
  );
  const intLength = namedCurve === "P-256" ? 32 : 48;
  const signature = concat(clampToLength(sigR, intLength), clampToLength(sigS, intLength));
  const signatureKey = await cryptoProxy_default.importKey("spki", publicKey, { name: "ECDSA", namedCurve }, false,
  ["verify"]);
  const certVerifyResult = await cryptoProxy_default.verify({ name: "ECDSA", hash }, signatureKey, signature, signedData);
  if (certVerifyResult !== true) throw new Error("ECDSA certificate verify failed");
}

// src/tls/verifyCerts.ts
async function verifyCerts(host, certs, rootCertsDatabase, requireServerTlsExtKeyUsage = true, requireDigitalSigKeyUsage = true) {
  for (const cert of certs) ;
  const userCert = certs[0];
  const matchingSubjectAltName = userCert.subjectAltNameMatchingHost(host);
  if (matchingSubjectAltName === void 0) throw new Error(`No matching subjectAltName for ${host}`);
  const validNow = userCert.isValidAtMoment();
  if (!validNow) throw new Error("End-user certificate is not valid now");
  if (requireServerTlsExtKeyUsage) {
    if (!userCert.extKeyUsage?.serverTls) throw new Error("End-user certificate has no TLS server extKeyUsage");
  }
  let verifiedToTrustedRoot = false;
  for (let i = 0, len = certs.length; i < len; i++) {
    const subjectCert = certs[i];
    const subjectAuthKeyId = subjectCert.authorityKeyIdentifier;
    let signingCert;
    if (subjectAuthKeyId === void 0) {
      signingCert = await TrustedCert.findInDatabase(subjectCert.issuer, rootCertsDatabase);
    } else {
      signingCert = await TrustedCert.findInDatabase(hexFromU8(subjectAuthKeyId), rootCertsDatabase);
    }
    if (signingCert !== void 0) {
    }
    if (signingCert === void 0) signingCert = certs[i + 1];
    if (signingCert === void 0) throw new Error("Ran out of certificates without reaching a trusted root");
    const signingCertIsTrustedRoot = signingCert instanceof TrustedCert;
    if (signingCert.isValidAtMoment() !== true) throw new Error("Signing certificate is not valid now");
    if (requireDigitalSigKeyUsage) {
      if (signingCert.keyUsage?.usages.has("digitalSignature") !== true) throw new Error("Signing certificate \
keyUsage does not include digital signatures");
    }
    if (signingCert.basicConstraints?.ca !== true) throw new Error("Signing certificate basicConstraints do no\
t indicate a CA certificate");
    const { pathLength } = signingCert.basicConstraints;
    if (pathLength === void 0) {
    } else {
      if (pathLength < i) throw new Error("Exceeded certificate pathLength");
    }
    if (subjectCert.algorithm === "1.2.840.10045.4.3.2" || subjectCert.algorithm === "1.2.840.10045.4.3.3") {
      const hash = subjectCert.algorithm === "1.2.840.10045.4.3.2" ? "SHA-256" : "SHA-384";
      const signingKeyOIDs = signingCert.publicKey.identifiers;
      const namedCurve = signingKeyOIDs.includes("1.2.840.10045.3.1.7") ? "P-256" : signingKeyOIDs.includes("1\
.3.132.0.34") ? "P-384" : void 0;
      if (namedCurve === void 0) throw new Error("Unsupported signing key curve");
      const sb = new ASN1Bytes(subjectCert.signature);
      await ecdsaVerify(sb, signingCert.publicKey.all, subjectCert.signedData, namedCurve, hash);
    } else if (subjectCert.algorithm === "1.2.840.113549.1.1.11" || subjectCert.algorithm === "1.2.840.113549.\
1.1.12") {
      const hash = subjectCert.algorithm === "1.2.840.113549.1.1.11" ? "SHA-256" : "SHA-384";
      const signatureKey = await cryptoProxy_default.importKey("spki", signingCert.publicKey.all, { name: "RSA\
SSA-PKCS1-v1_5", hash }, false, ["verify"]);
      const certVerifyResult = await cryptoProxy_default.verify({ name: "RSASSA-PKCS1-v1_5" }, signatureKey, subjectCert.
      signature, subjectCert.signedData);
      if (certVerifyResult !== true) throw new Error("RSASSA_PKCS1-v1_5-SHA256 certificate verify failed");
    } else {
      throw new Error("Unsupported signing algorithm");
    }
    if (signingCertIsTrustedRoot) {
      verifiedToTrustedRoot = true;
      break;
    }
  }
  return verifiedToTrustedRoot;
}

// src/tls/readEncryptedHandshake.ts
var txtEnc3 = new TextEncoder();
async function readEncryptedHandshake(host, hs, serverSecret, hellos, rootCertsDatabase, requireServerTlsExtKeyUsage = true, requireDigitalSigKeyUsage = true) {
  await hs.expectUint8(8, 0);
  const [eeMessageEnd] = await hs.expectLengthUint24();
  const [extEnd, extRemaining] = await hs.expectLengthUint16(0);
  while (extRemaining() > 0) {
    const extType = await hs.readUint16(0);
    if (extType === 0) {
      await hs.expectUint16(0, 0);
    } else if (extType === 10) {
      const [endGroupsData] = await hs.expectLengthUint16(0);
      const [endGroups, groupsRemaining] = await hs.expectLengthUint16(0);
      while (groupsRemaining() > 0) {
        const group = await hs.readUint16();
        if (0) {
          const groupName = {
            23: "secp256r1",
            24: "secp384r1",
            25: "secp521r1",
            29: "x25519",
            30: "x448",
            256: "ffdhe2048",
            257: "ffdhe3072",
            258: "ffdhe4096",
            259: "ffdhe6144",
            260: "ffdhe8192"
          }[group] ?? "unrecognised group";
          hs.comment(`group: ${groupName}`);
        }
      }
      endGroups();
      endGroupsData();
    } else {
      throw new Error(`Unsupported server encrypted extension type 0x${hexFromU8([extType]).padStart(4, "0")}`);
    }
  }
  extEnd();
  eeMessageEnd();
  let clientCertRequested = false;
  let certMsgType = await hs.readUint8();
  if (certMsgType === 13) {
    clientCertRequested = true;
    const [endCertReq] = await hs.expectLengthUint24("certificate request data");
    await hs.expectUint8(0, 0);
    const [endCertReqExts, certReqExtsRemaining] = await hs.expectLengthUint16("certificate request extensions");
    await hs.skipRead(certReqExtsRemaining(), 0);
    endCertReqExts();
    endCertReq();
    certMsgType = await hs.readUint8();
  }
  if (certMsgType !== 11) throw new Error(`Unexpected handshake message type 0x${hexFromU8([certMsgType])}`);
  const [endCertPayload] = await hs.expectLengthUint24(0);
  await hs.expectUint8(0, 0);
  const [endCerts, certsRemaining] = await hs.expectLengthUint24(0);
  const certs = [];
  while (certsRemaining() > 0) {
    const [endCert] = await hs.expectLengthUint24(0);
    const cert = await Cert.create(hs);
    certs.push(cert);
    endCert();
    const [endCertExt, certExtRemaining] = await hs.expectLengthUint16("certificate extensions");
    await hs.skipRead(certExtRemaining());
    endCertExt();
  }
  endCerts();
  endCertPayload();
  if (certs.length === 0) throw new Error("No certificates supplied");
  const userCert = certs[0];
  const certVerifyHandshakeData = hs.data.subarray(0, hs.offset);
  const certVerifyData = concat(hellos, certVerifyHandshakeData);
  const certVerifyHashBuffer = await cryptoProxy_default.digest("SHA-256", certVerifyData);
  const certVerifyHash = new Uint8Array(certVerifyHashBuffer);
  const certVerifySignedData = concat(txtEnc3.encode(" ".repeat(64) + "TLS 1.3, server CertificateVerify"), [0],
  certVerifyHash);
  await hs.expectUint8(15, 0);
  const [endCertVerifyPayload] = await hs.expectLengthUint24(0);
  const sigType = await hs.readUint16();
  if (sigType === 1027) {
    const [endSignature] = await hs.expectLengthUint16();
    await ecdsaVerify(hs, userCert.publicKey.all, certVerifySignedData, "P-256", "SHA-256");
    endSignature();
  } else if (sigType === 2052) {
    const [endSignature, signatureRemaining] = await hs.expectLengthUint16();
    const signature = await hs.subarrayForRead(signatureRemaining());
    endSignature();
    const signatureKey = await cryptoProxy_default.importKey("spki", userCert.publicKey.all, { name: "RSA-PSS",
    hash: "SHA-256" }, false, ["verify"]);
    const certVerifyResult = await cryptoProxy_default.verify({
      name: "RSA-PSS",
      saltLength: 32
      /* SHA-256 length in bytes */
    }, signatureKey, signature, certVerifySignedData);
    if (certVerifyResult !== true) throw new Error("RSA-PSS-RSAE-SHA256 certificate verify failed");
  } else {
    throw new Error(`Unsupported certificate verify signature type 0x${hexFromU8([sigType]).padStart(4, "0")}`);
  }
  endCertVerifyPayload();
  const verifyHandshakeData = hs.data.subarray(0, hs.offset);
  const verifyData = concat(hellos, verifyHandshakeData);
  const finishedKey = await hkdfExpandLabel(serverSecret, "finished", new Uint8Array(0), 32, 256);
  const finishedHash = await cryptoProxy_default.digest("SHA-256", verifyData);
  const hmacKey = await cryptoProxy_default.importKey("raw", finishedKey, { name: "HMAC", hash: { name: "SHA-2\
56" } }, false, ["sign"]);
  const correctVerifyHashBuffer = await cryptoProxy_default.sign("HMAC", hmacKey, finishedHash);
  const correctVerifyHash = new Uint8Array(correctVerifyHashBuffer);
  await hs.expectUint8(20, 0);
  const [endHsFinishedPayload, hsFinishedPayloadRemaining] = await hs.expectLengthUint24(0);
  const verifyHash = await hs.readBytes(hsFinishedPayloadRemaining());
  endHsFinishedPayload();
  if (hs.readRemaining() !== 0) throw new Error("Unexpected extra bytes in server handshake");
  const verifyHashVerified = equal(verifyHash, correctVerifyHash);
  if (verifyHashVerified !== true) throw new Error("Invalid server verify hash");
  const verifiedToTrustedRoot = await verifyCerts(host, certs, rootCertsDatabase, requireServerTlsExtKeyUsage,
  requireDigitalSigKeyUsage);
  if (!verifiedToTrustedRoot) throw new Error("Validated certificate chain did not end in a trusted root");
  return { handshakeData: hs.data.subarray(0, hs.offset), clientCertRequested, userCert };
}

// src/tls/startTls.ts
async function startTls(host, rootCertsDatabase, networkRead, networkWrite, { useSNI, requireServerTlsExtKeyUsage,
requireDigitalSigKeyUsage, writePreData, expectPreData, commentPreData } = {}) {
  useSNI ?? (useSNI = true);
  requireServerTlsExtKeyUsage ?? (requireServerTlsExtKeyUsage = true);
  requireDigitalSigKeyUsage ?? (requireDigitalSigKeyUsage = true);
  if (typeof rootCertsDatabase === "string") rootCertsDatabase = await TrustedCert.databaseFromPEM(rootCertsDatabase);
  const ecdhKeys = await cryptoProxy_default.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["derive\
Key", "deriveBits"]);
  const rawPublicKeyBuffer = await cryptoProxy_default.exportKey("raw", ecdhKeys.publicKey);
  const rawPublicKey = new Uint8Array(rawPublicKeyBuffer);
  if (0) {
    const privateKeyJWK = await cryptoProxy_default.exportKey("jwk", ecdhKeys.privateKey);
    log7("We begin the TLS connection by generating an [ECDH](https://en.wikipedia.org/wiki/Elliptic-curve_Dif\
fie%E2%80%93Hellman) key pair using curve [P-256](https://neuromancer.sk/std/nist/P-256). The private key, d, \
is simply a 256-bit integer picked at random:");
    log7(...highlightColonList3("d: " + hexFromU84(fromBase642(privateKeyJWK.d, { alphabet: "base64url" }))));
    log7("The public key is a point on the curve. The point is [derived from d and a base point](https://curve\
s.xargs.org). It\u2019s identified by coordinates x and y.");
    log7(...highlightColonList3("x: " + hexFromU84(fromBase642(privateKeyJWK.x, { alphabet: "base64url" }))));
    log7(...highlightColonList3("y: " + hexFromU84(fromBase642(privateKeyJWK.y, { alphabet: "base64url" }))));
  }
  const sessionId = new Uint8Array(32);
  await getRandomValues(sessionId);
  const clientHello = await makeClientHello(host, rawPublicKey, sessionId, useSNI);
  const clientHelloData = clientHello.array();
  const initialData = writePreData ? concat(writePreData, clientHelloData) : clientHelloData;
  networkWrite(initialData);
  if (expectPreData) {
    const receivedPreData = await networkRead(expectPreData.length);
    if (!receivedPreData || !equal(receivedPreData, expectPreData)) throw new Error("Pre data did not match ex\
pectation");
  }
  const serverHello = bytesFromTlsRecords(networkRead, 22 /* Handshake */);
  const serverPublicKey = await parseServerHello(serverHello, sessionId);
  const ccipher = bytesFromTlsRecords(networkRead, 20 /* ChangeCipherSpec */);
  await ccipher.expectUint8(1, 0);
  const clientHelloContent = clientHelloData.subarray(5);
  const serverHelloContent = serverHello.array();
  const hellos = concat(clientHelloContent, serverHelloContent);
  const handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16);
  const serverHandshakeKey = await cryptoProxy_default.importKey("raw", handshakeKeys.serverHandshakeKey, { name: "\
AES-GCM" }, false, ["decrypt"]);
  const handshakeDecrypter = new Crypter("decrypt", serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await cryptoProxy_default.importKey("raw", handshakeKeys.clientHandshakeKey, { name: "\
AES-GCM" }, false, ["encrypt"]);
  const handshakeEncrypter = new Crypter("encrypt", clientHandshakeKey, handshakeKeys.clientHandshakeIV);
  const handshakeBytes = bytesFromEncryptedTlsRecords(networkRead, handshakeDecrypter, 22 /* Handshake */);
  const { handshakeData: serverHandshake, clientCertRequested, userCert } = await readEncryptedHandshake(
    host,
    handshakeBytes,
    handshakeKeys.serverSecret,
    hellos,
    rootCertsDatabase,
    requireServerTlsExtKeyUsage,
    requireDigitalSigKeyUsage
  );
  const clientCipherChange = new Bytes(6);
  clientCipherChange.writeUint8(20, 0);
  clientCipherChange.writeUint16(771, 0);
  const endClientCipherChangePayload = clientCipherChange.writeLengthUint16();
  clientCipherChange.writeUint8(1, 0);
  endClientCipherChangePayload();
  const clientCipherChangeData = clientCipherChange.array();
  let clientCertRecordData = new Uint8Array(0);
  if (clientCertRequested) {
    const clientCertRecord = new Bytes(8);
    clientCertRecord.writeUint8(11, 0);
    const endClientCerts = clientCertRecord.writeLengthUint24("client certificate data");
    clientCertRecord.writeUint8(0, 0);
    clientCertRecord.writeUint24(0, 0);
    endClientCerts();
    clientCertRecordData = clientCertRecord.array();
  }
  const wholeHandshake = concat(hellos, serverHandshake, clientCertRecordData);
  const wholeHandshakeHashBuffer = await cryptoProxy_default.digest("SHA-256", wholeHandshake);
  const wholeHandshakeHash = new Uint8Array(wholeHandshakeHashBuffer);
  const finishedKey = await hkdfExpandLabel(handshakeKeys.clientSecret, "finished", new Uint8Array(0), 32, 256);
  const verifyHmacKey = await cryptoProxy_default.importKey("raw", finishedKey, { name: "HMAC", hash: { name: "\
SHA-256" } }, false, ["sign"]);
  const verifyDataBuffer = await cryptoProxy_default.sign("HMAC", verifyHmacKey, wholeHandshakeHash);
  const verifyData = new Uint8Array(verifyDataBuffer);
  const clientFinishedRecord = new Bytes(36);
  clientFinishedRecord.writeUint8(20, 0);
  const clientFinishedRecordEnd = clientFinishedRecord.writeLengthUint24(0);
  clientFinishedRecord.writeBytes(verifyData);
  clientFinishedRecordEnd();
  const clientFinishedRecordData = clientFinishedRecord.array();
  const encryptedClientFinished = await makeEncryptedTlsRecords(concat(clientCertRecordData, clientFinishedRecordData),
  handshakeEncrypter, 22 /* Handshake */);
  let partialHandshakeHash = wholeHandshakeHash;
  if (clientCertRecordData.length > 0) {
    const partialHandshake = wholeHandshake.subarray(0, wholeHandshake.length - clientCertRecordData.length);
    const partialHandshakeHashBuffer = await cryptoProxy_default.digest("SHA-256", partialHandshake);
    partialHandshakeHash = new Uint8Array(partialHandshakeHashBuffer);
  }
  const applicationKeys = await getApplicationKeys(handshakeKeys.handshakeSecret, partialHandshakeHash, 256, 16);
  const clientApplicationKey = await cryptoProxy_default.importKey("raw", applicationKeys.clientApplicationKey,
  { name: "AES-GCM" }, true, ["encrypt"]);
  const applicationEncrypter = new Crypter("encrypt", clientApplicationKey, applicationKeys.clientApplicationIV);
  const serverApplicationKey = await cryptoProxy_default.importKey("raw", applicationKeys.serverApplicationKey,
  { name: "AES-GCM" }, true, ["decrypt"]);
  const applicationDecrypter = new Crypter("decrypt", serverApplicationKey, applicationKeys.serverApplicationIV);
  let wroteFinishedRecords = false;
  const read = () => {
    if (!wroteFinishedRecords) {
      const finishedRecords = concat(clientCipherChangeData, ...encryptedClientFinished);
      networkWrite(finishedRecords);
      wroteFinishedRecords = true;
    }
    return readEncryptedTlsRecord(networkRead, applicationDecrypter);
  };
  const write = async (data) => {
    const localWroteFinishedRecords = wroteFinishedRecords;
    wroteFinishedRecords = true;
    const encryptedRecords = await makeEncryptedTlsRecords(data, applicationEncrypter, 23 /* Application */);
    const allRecords = localWroteFinishedRecords ? concat(...encryptedRecords) : concat(clientCipherChangeData,
    ...encryptedClientFinished, ...encryptedRecords);
    networkWrite(allRecords);
  };
  return { read, write, userCert };
}

// src/util/stableStringify.ts
function stableStringify(x, replacer = (_, v) => v, indent) {
  const deterministicReplacer = (k, v) => replacer(
    k,
    typeof v !== "object" || v === null || Array.isArray(v) ? v : Object.fromEntries(Object.entries(v).sort(([
    ka], [kb]) => ka < kb ? -1 : ka > kb ? 1 : 0))
  );
  return JSON.stringify(x, deterministicReplacer, indent);
}
export {
  ASN1Bytes,
  Bytes,
  Cert,
  LazyReadFunctionReadQueue,
  ReadMode,
  ReadQueue,
  SocketReadQueue,
  TrustedCert,
  WebSocketReadQueue,
  _fromBase64,
  _fromHex,
  _fromHexChunked,
  _toBase64,
  _toBase64Chunked,
  _toHex,
  _toHexChunked,
  allKeyUsages,
  fromBase64,
  fromHex,
  hexFromU8,
  stableStringify,
  startTls,
  toBase64,
  toHex,
  u8FromHex
};
