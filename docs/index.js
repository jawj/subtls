var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  const len = in8.length, halfLen = len >>> 1, quarterLen = len >>> 2, out16 = scratchArr || new Uint16Array(len), in32 = new Uint32Array(
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
var chpairsStd;
var chpairsUrl;
function _toBase64(d, { omitPadding, alphabet, scratchArr } = {}) {
  if (!chpairsStd) {
    chpairsStd = new Uint16Array(4096);
    if (littleEndian) for (let i2 = 0; i2 < 64; i2++) for (let j2 = 0; j2 < 64; j2++) chpairsStd[i2 << 6 | j2] = b64ChStd[i2] | b64ChStd[j2] << 8;
    else for (let i2 = 0; i2 < 64; i2++) for (let j2 = 0; j2 < 64; j2++) chpairsStd[i2 << 6 | j2] = b64ChStd[i2] << 8 | b64ChStd[j2];
    chpairsUrl = chpairsStd.slice();
    if (littleEndian) {
      for (let i2 = 0; i2 < 64; i2++) for (let j2 = 62; j2 < 64; j2++) chpairsUrl[i2 << 6 | j2] = b64ChUrl[i2] | b64ChUrl[j2] << 8;
      for (let i2 = 62; i2 < 64; i2++) for (let j2 = 0; j2 < 62; j2++) chpairsUrl[i2 << 6 | j2] = b64ChUrl[i2] | b64ChUrl[j2] << 8;
    } else {
      for (let i2 = 0; i2 < 64; i2++) for (let j2 = 62; j2 < 64; j2++) chpairsUrl[i2 << 6 | j2] = b64ChUrl[i2] << 8 | b64ChUrl[j2];
      for (let i2 = 62; i2 < 64; i2++) for (let j2 = 0; j2 < 62; j2++) chpairsUrl[i2 << 6 | j2] = b64ChUrl[i2] << 8 | b64ChUrl[j2];
    }
  }
  if (d.byteOffset % 4 !== 0) d = new Uint8Array(d);
  const urlsafe = alphabet === "base64url", ch = urlsafe ? b64ChUrl : b64ChStd, chpairs = urlsafe ? chpairsUrl : chpairsStd, inlen = d.length, last2 = inlen - 2, inints = inlen >>> 2, intlast3 = inints - 3, d32 = new Uint32Array(d.buffer, d.byteOffset, inints), outints = Math.ceil(inlen / 3), out = scratchArr || new Uint32Array(outints);
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
    out[j++] = chpairs[b1 << 4 | b2 >>> 4] << (littleEndian ? 0 : 16) | chpairs[(b2 & 15) << 8 | b3] << (littleEndian ? 16 : 0);
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
  const inBytes = d.length, outInts = Math.ceil(inBytes / 3), outChunkInts = chunkBytes >>> 2, chunksCount = Math.ceil(outInts / outChunkInts), inChunkBytes = outChunkInts * 3, scratchArr = new Uint32Array(chunksCount > 1 ? outChunkInts : outInts);
  let b64 = "";
  for (let i = 0; i < chunksCount; i++) {
    const startInBytes = i * inChunkBytes, endInBytes = startInBytes + inChunkBytes, startOutInts = i * outChunkInts, endOutInts = Math.min(startOutInts + outChunkInts, outInts);
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
      const cl = b64ChStd[l], cr = b64ChStd[r], vin = littleEndian ? cr << 8 | cl : cr | cl << 8, vout = l << 6 | r;
      stdWordLookup[vin] = vout;
    }
  }
  if (!urlWordLookup && alphabet === "base64url") {
    urlWordLookup = new Uint16Array(vzz + 1);
    for (let l = 0; l < 64; l++) for (let r = 0; r < 64; r++) {
      const cl = b64ChUrl[l], cr = b64ChUrl[r], vin = littleEndian ? cr << 8 | cl : cr | cl << 8, vout = l << 6 | r;
      urlWordLookup[vin] = vout;
    }
  }
  if (!anyWordLookup && alphabet === "base64any") {
    anyWordLookup = new Uint16Array(vzz + 1);
    for (let l = 0; l < 64; l++) for (let r = 0; r < 64; r++) {
      const cl = b64ChStd[l], cr = b64ChStd[r], vin = littleEndian ? cr << 8 | cl : cr | cl << 8, vout = l << 6 | r;
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
    urlByteLookup[9] = urlByteLookup[10] = urlByteLookup[13] = urlByteLookup[32] = anyByteLookup[9] = anyByteLookup[10] = anyByteLookup[13] = anyByteLookup[32] = 64;
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
  ), outInts = new Uint32Array(outBytes.buffer, 0, maxOutBytesLen >>> 2), wl = alphabet === "base64url" ? urlWordLookup : alphabet === "base64any" ? anyWordLookup : stdWordLookup, bl = alphabet === "base64url" ? urlByteLookup : alphabet === "base64any" ? anyByteLookup : stdByteLookup;
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
    outInts[j++] = (vL2 & 15) << 4 | (vR2 & 65280) >>> 8 | (vR2 & 255) << 8 | (vL3 & 4080) << 12 | (vL3 & 15) << 28 | (vR3 & 65280) << 16;
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
  if (typeof Uint8Array.fromBase64 === "function" && options.onInvalidInput !== "skip" && options.alphabet !== "base64any") return Uint8Array.fromBase64(s, options);
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
var initialSize = 256;
var growthFactor = 2;
var txtEnc = new TextEncoder();
var txtDec = new TextDecoder();
var emptyArray = new Uint8Array(0);
var hexLookup = [];
for (let i = 0; i < 256; i++) hexLookup[i] = i.toString(16).padStart(2, "0") + " ";
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
    __publicField(this, "fetchPoints");
    this.endOfReadableData = this.offset = 0;
    this.comments = {};
    this.indents = { 0: indent };
    this.fetchPoints = /* @__PURE__ */ new Set();
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
  changeIndent(indentDelta) {
    this.indent += indentDelta;
    this.indents[this.offset] = this.indent;
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
      const e = new Error(`Not enough data: requested ${bytes} byte(s), received ${newData === void 0 ? "EOF" : `${newData.length} byte(s)`}`);
      e._bytes_error_reason = "EOF";
      throw e;
    }
    for (const fetchPoint of newData.fetchPoints ?? []) this.fetchPoints.add(fetchPoint + this.endOfReadableData);
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
    this.changeIndent(indentDelta);
    return [
      () => {
        this.changeIndent(-indentDelta);
        if (this.offset !== endOffset) throw new Error(`${length} bytes expected but ${this.offset - startOffset} advanced`);
      },
      () => endOffset - this.offset
    ];
  }
  comment(s, offset = this.offset) {
    if (false) throw new Error("No comments should be emitted outside of chatty mode");
    const existing = this.comments[offset];
    const result = (existing === void 0 ? "" : existing + " ") + s;
    this.comments[offset] = result;
    return this;
  }
  lengthComment(length, comment, inclusive = false) {
    return length === 1 ? `${length} byte${comment ? ` of ${comment}` : ""} ${inclusive ? "starts here" : "follows"}` : `${length === 0 ? "no" : length} bytes${comment ? ` of ${comment}` : ""} ${inclusive ? "start here" : "follow"}`;
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
    this.comment('"' + s.replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"');
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
    if (comment) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  async readUint16(comment) {
    await this.ensureReadAvailable(2);
    const result = this.dataView.getUint16(this.offset);
    this.offset += 2;
    if (comment) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  async readUint24(comment) {
    const msb = await this.readUint8();
    const lsbs = await this.readUint16();
    const result = (msb << 16) + lsbs;
    if (comment) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  async readUint32(comment) {
    await this.ensureReadAvailable(4);
    const result = this.dataView.getUint32(this.offset);
    this.offset += 4;
    if (comment) this.comment(comment.replace(/%/g, String(result)));
    return result;
  }
  async expectBytes(expected, comment) {
    await this.ensureReadAvailable(expected.length);
    const actual = await this.readBytes(expected.length);
    if (comment) this.comment(comment);
    if (!equal(actual, expected)) throw new Error("Unexpected bytes");
  }
  async expectUint8(expectedValue, comment) {
    const actualValue = await this.readUint8();
    if (comment) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected u8 ${expectedValue}, got ${actualValue}`);
  }
  async expectUint16(expectedValue, comment) {
    const actualValue = await this.readUint16();
    if (comment) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected u16 ${expectedValue}, got ${actualValue}`);
  }
  async expectUint24(expectedValue, comment) {
    const actualValue = await this.readUint24();
    if (comment) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected u24 ${expectedValue}, got ${actualValue}`);
  }
  async expectUint32(expectedValue, comment) {
    const actualValue = await this.readUint32();
    if (comment) this.comment(comment);
    if (actualValue !== expectedValue) throw new Error(`Expected u32 ${expectedValue}, got ${actualValue}`);
  }
  async expectReadLength(length, indentDelta = 1) {
    await this.ensureReadAvailable(length);
    return this.expectLength(length, indentDelta);
  }
  async expectLengthUint8(comment) {
    const length = await this.readUint8();
    this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }
  async expectLengthUint16(comment) {
    const length = await this.readUint16();
    this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }
  async expectLengthUint24(comment) {
    const length = await this.readUint24();
    this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }
  async expectLengthUint32(comment) {
    const length = await this.readUint32();
    this.comment(this.lengthComment(length, comment));
    return this.expectReadLength(length);
  }
  async expectLengthUint8Incl(comment) {
    const length = await this.readUint8();
    this.comment(this.lengthComment(length, comment, true));
    return this.expectReadLength(length - 1);
  }
  async expectLengthUint16Incl(comment) {
    const length = await this.readUint16();
    this.comment(this.lengthComment(length, comment, true));
    return this.expectReadLength(length - 2);
  }
  async expectLengthUint24Incl(comment) {
    const length = await this.readUint24();
    this.comment(this.lengthComment(length, comment, true));
    return this.expectReadLength(length - 3);
  }
  async expectLengthUint32Incl(comment) {
    const length = await this.readUint32();
    this.comment(this.lengthComment(length, comment, true));
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
    this.comment('"' + s.replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"');
    return this;
  }
  writeUTF8StringNullTerminated(s) {
    const bytes = txtEnc.encode(s);
    this.writeBytes(bytes);
    this.comment('"' + s.replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"');
    this.writeUint8(0);
    this.comment("end of string");
    return this;
  }
  writeUint8(value, comment) {
    this.ensureWriteAvailable(1);
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
    if (comment) this.comment(comment);
    return this;
  }
  writeUint16(value, comment) {
    this.ensureWriteAvailable(2);
    this.dataView.setUint16(this.offset, value);
    this.offset += 2;
    if (comment) this.comment(comment);
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
    if (comment) this.comment(comment);
    return this;
  }
  // forward-looking lengths
  _writeLengthGeneric(lengthBytes, inclusive, comment) {
    this.ensureWriteAvailable(lengthBytes);
    const startOffset = this.offset;
    this.offset += lengthBytes;
    const endOffset = this.offset;
    this.changeIndent(1);
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
      this.comment(this.lengthComment(length, comment, inclusive), endOffset);
      this.changeIndent(-1);
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
      s += hexLookup[this.data[i]];
      const comment = this.comments[i + 1];
      indent = this.indents[i + 1] ?? indent;
      if (comment) {
        s += ` ${comment}`;
        if (i < len - 1) s += `
${indentChars.repeat(indent)}`;
      }
      if (this.fetchPoints.has(i + 1)) s += "\n--- next TLS record ---\n";
    }
    return s;
  }
};

// src/presentation/highlights.ts
var regex = new RegExp(`  .+|^(${indentChars})+|--- next TLS record ---`, "gm");
var dotColour = "color: #ccc";
var textColour = "color: #111";
var mutedColour = "color: #777";
function highlightBytes(s, colour) {
  const css = [textColour];
  s = "%c" + s.replace(regex, (m) => {
    css.push(
      m === "--- next TLS record ---" || m.startsWith(indentChars) ? dotColour : `color: ${colour}`,
      textColour
    );
    return `%c\u200B${m}\u200B%c`;
  });
  return [s, ...css];
}
function highlightColonList(s) {
  const css = [];
  s = s.replace(/^[^:]+:.*$/gm, (m) => {
    const colonIndex = m.indexOf(":");
    css.push(mutedColour, textColour);
    return `%c${m.slice(0, colonIndex + 1)}%c${m.slice(colonIndex + 1)}`;
  });
  return [s, ...css];
}

// src/presentation/log.ts
function htmlEscape(s, linkUrls = true) {
  const escapes = {
    // initialize here, not globally, or this appears in exported output
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  };
  const urlre = /\bhttps?:[/][/][^\s\u200b"'<>)]+[^\s\u200b"'<>).,:;?!]\b/;
  const regexp = new RegExp(
    (linkUrls ? `\\[[^\\]\\n]+\\]\\(${urlre.source}\\)|${urlre.source}|` : "") + "[" + Object.keys(escapes).join("") + "]",
    "gi"
  );
  const replaced = s.replace(regexp, (match) => {
    if (match.length === 1) return escapes[match];
    let linkText, url;
    if (match.charAt(0) === "[") {
      const closeBracketPos = match.indexOf("]");
      linkText = htmlEscape(match.substring(1, closeBracketPos), false);
      url = htmlEscape(match.substring(closeBracketPos + 2, match.length - 1), false);
    } else {
      url = linkText = htmlEscape(match, false);
    }
    return `<a href="${url}" target="_blank">${linkText}</a>`;
  });
  return replaced;
}
function htmlFromLogArgs(...args) {
  let result = "<span>", arg, matchArr, separator = "";
  while ((arg = args.shift()) !== void 0) {
    arg = separator + htmlEscape(String(arg));
    separator = " ";
    const formatRegExp = /([\s\S]*?)%([csoOidf])|[\s\S]+/g;
    while ((matchArr = formatRegExp.exec(arg)) !== null) {
      const [whole, literal, sub] = matchArr;
      if (sub === void 0) {
        result += whole;
      } else {
        result += literal;
        if (sub === "c") {
          result += `</span><span style="${args.shift()}">`;
        } else if (sub === "s") {
          result += htmlEscape(args.shift());
        } else if (sub === "o" || sub === "O") {
          result += JSON.stringify(args.shift(), void 0, sub === "O" ? 2 : void 0);
        } else if (sub === "i" || sub === "d" || sub === "f") {
          result += String(args.shift());
        }
      }
    }
  }
  result += "</span>";
  return result;
}
var c = 0;
var appendLog = Symbol("append");
function log(...args) {
  const append = args[0] === appendLog;
  if (append) args = args.slice(1);
  console.log(...args, "\n");
  if (typeof document === "undefined") return;
  const docEl = document.documentElement;
  const fullyScrolled = docEl.scrollTop >= docEl.scrollHeight - docEl.clientHeight - 1 || // the -1 makes this work in Edge
  docEl.clientHeight >= docEl.scrollHeight;
  const element = document.querySelector("#logs");
  if (append) {
    const sections = element.querySelectorAll(".section");
    sections[sections.length - 1].insertAdjacentHTML("beforeend", htmlFromLogArgs("\n" + args[0], ...args.slice(1)));
  } else {
    element.innerHTML += `<label><input type="checkbox" name="c${c++}" checked="checked"><div class="section">` + htmlFromLogArgs(...args) + "</div></label>";
  }
  if (fullyScrolled) window.scrollTo({ top: 99999, behavior: "auto" });
}

// src/util/cryptoRandom.ts
var cryptoPromise = typeof crypto !== "undefined" ? Promise.resolve(crypto) : (
  // browsers and Node 19+
  import("crypto").then((c2) => c2.webcrypto)
);
async function getRandomValues(...args) {
  const c2 = await cryptoPromise;
  return c2.getRandomValues(...args);
}

// src/tls/makeClientHello.ts
async function makeClientHello(host, publicKey, sessionId, useSNI = true, protocolsForALPN) {
  const h = new Bytes();
  h.writeUint8(22, "record type: handshake");
  h.writeUint16(769, "TLS legacy record version 1.0 ([RFC 8446 \xA75.1](https://datatracker.ietf.org/doc/html/rfc8446#section-5.1))");
  const endRecordHeader = h.writeLengthUint16("TLS record");
  h.writeUint8(1, "handshake type: client hello");
  const endHandshakeHeader = h.writeLengthUint24();
  h.writeUint16(771, "TLS version 1.2 (middlebox compatibility: see [blog.cloudflare.com](https://blog.cloudflare.com/why-tls-1-3-isnt-in-browsers-yet))");
  await getRandomValues(h.subarrayForWrite(32));
  h.comment("client random");
  const endSessionId = h.writeLengthUint8("session ID");
  h.writeBytes(sessionId);
  h.comment("session ID (middlebox compatibility again: [RFC 8446 appendix D4](https://datatracker.ietf.org/doc/html/rfc8446#appendix-D.4))");
  endSessionId();
  const endCiphers = h.writeLengthUint16("ciphers ([RFC 8446 appendix B4](https://datatracker.ietf.org/doc/html/rfc8446#appendix-B.4))");
  h.writeUint16(4865, "cipher: TLS_AES_128_GCM_SHA256");
  endCiphers();
  const endCompressionMethods = h.writeLengthUint8("compression methods");
  h.writeUint8(0, "compression method: none");
  endCompressionMethods();
  const endExtensions = h.writeLengthUint16("extensions ([RFC 8446 \xA74.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2))");
  if (useSNI) {
    h.writeUint16(0, "extension type: Server Name Indication, or SNI ([RFC 6066 \xA73](https://datatracker.ietf.org/doc/html/rfc6066#section-3))");
    const endSNIExt = h.writeLengthUint16("SNI data");
    const endSNI = h.writeLengthUint16("SNI records");
    h.writeUint8(0, "list entry type: DNS hostname");
    const endHostname = h.writeLengthUint16("hostname");
    h.writeUTF8String(host);
    endHostname();
    endSNI();
    endSNIExt();
  }
  if (protocolsForALPN) {
    h.writeUint16(16, "extension type: Application-Layer Protocol Negotiation, or ALPN ([RFC 7301](https://datatracker.ietf.org/doc/html/rfc7301))");
    const endALPNExt = h.writeLengthUint16("ALPN data");
    const endALPN = h.writeLengthUint16("protocols");
    for (const protocol of protocolsForALPN) {
      const endProtocol = h.writeLengthUint8("protocol");
      h.writeUTF8String(protocol);
      endProtocol();
    }
    endALPN();
    endALPNExt();
  }
  h.writeUint16(11, "extension type: supported Elliptic Curve point formats (for middlebox compatibility, from TLS 1.2: [RFC 8422 \xA75.1.2](https://datatracker.ietf.org/doc/html/rfc8422#section-5.1.2))");
  const endFormatTypesExt = h.writeLengthUint16("point formats data");
  const endFormatTypes = h.writeLengthUint8("point formats");
  h.writeUint8(0, "point format: uncompressed");
  endFormatTypes();
  endFormatTypesExt();
  h.writeUint16(10, "extension type: supported groups for key exchange ([RFC 8446 \xA74.2.7](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7))");
  const endGroupsExt = h.writeLengthUint16("groups data");
  const endGroups = h.writeLengthUint16("groups");
  h.writeUint16(23, "group: elliptic curve secp256r1");
  endGroups();
  endGroupsExt();
  h.writeUint16(13, "extension type: signature algorithms ([RFC 8446 \xA74.2.3](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.3))");
  const endSigsExt = h.writeLengthUint16("signature algorithms data");
  const endSigs = h.writeLengthUint16("signature algorithms");
  h.writeUint16(1027, "algorithm: ecdsa_secp256r1_sha256");
  h.writeUint16(2052, "algorithm: rsa_pss_rsae_sha256");
  endSigs();
  endSigsExt();
  h.writeUint16(43, "extension type: supported TLS versions ([RFC 8446 \xA74.2.1](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.1))");
  const endVersionsExt = h.writeLengthUint16("TLS versions data");
  const endVersions = h.writeLengthUint8("TLS versions");
  h.writeUint16(772, "TLS version: 1.3");
  endVersions();
  endVersionsExt();
  h.writeUint16(51, "extension type: key share ([RFC 8446 \xA74.2.8](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8))");
  const endKeyShareExt = h.writeLengthUint16("key share data");
  const endKeyShares = h.writeLengthUint16("key shares");
  h.writeUint16(23, "secp256r1 (NIST P-256) key share ([RFC 8446 \xA74.2.7](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7))");
  const endKeyShare = h.writeLengthUint16("key share");
  if (1) {
    h.writeUint8(publicKey[0], "legacy point format: always 4, which means uncompressed ([RFC 8446 \xA74.2.8.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2) and [RFC 8422 \xA75.4.1](https://datatracker.ietf.org/doc/html/rfc8422#section-5.4.1))");
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
  if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
  if (spacer === "") return toHex(u8);
  if (spacer === " ") return toHexSpaced(u8);
  throw new Error("Spacer may only be empty or a single space");
}
var te2 = new TextEncoder();
var td2 = new TextDecoder();
var littleEndian2 = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
var hexChars = te2.encode("0123456789abcdef");
var ccEvens = new Uint16Array(256);
var ccOdds = new Uint32Array(256);
if (littleEndian2) for (let i = 0; i < 256; i++) {
  ccEvens[i] = hexChars[i & 15] << 8 | hexChars[i >>> 4];
  ccOdds[i] = 32 << 16 | hexChars[i >>> 4] << 24 | hexChars[i & 15] | 32 << 8;
}
else for (let i = 0; i < 256; i++) {
  ccEvens[i] = hexChars[i & 15] | hexChars[i >>> 4] << 8;
  ccOdds[i] = 32 << 24 | hexChars[i >>> 4] << 16 | hexChars[i & 15] << 8 | 32;
}
function toHexSpaced(in8) {
  const bytes = in8.length;
  const out16 = new Uint16Array(bytes * 1.5 << 0);
  let outIndex = 0;
  for (let i = 0; i < bytes; i += 2) {
    out16[outIndex++] = ccEvens[in8[i]];
    const ccOdd = ccOdds[in8[i + 1]];
    out16[outIndex++] = ccOdd >>> 16;
    out16[outIndex++] = ccOdd & 65535;
  }
  const out8 = new Uint8Array(out16.buffer);
  return td2.decode(out8.subarray(0, bytes * 3 - 1));
}

// src/tls/parseServerHello.ts
async function parseServerHello(h, sessionId) {
  let serverPublicKey;
  let tlsVersionSpecified;
  await h.expectUint8(2, "handshake type: server hello");
  const [endServerHello] = await h.expectLengthUint24("server hello");
  await h.expectUint16(771, "TLS version 1.2 (middlebox compatibility)");
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
  h.comment('server random \u2014 [not SHA256("HelloRetryRequest")](https://datatracker.ietf.org/doc/html/rfc8446#section-4.1.3)');
  await h.expectUint8(sessionId.length, "session ID length (matches client session ID)");
  await h.expectBytes(sessionId, "session ID (matches client session ID)");
  await h.expectUint16(4865, "cipher (matches client hello)");
  await h.expectUint8(0, "no compression");
  const [endExtensions, extensionsRemaining] = await h.expectLengthUint16("extensions");
  while (extensionsRemaining() > 0) {
    const extensionType = await h.readUint16("extension type:");
    const extensionTypeName = {
      43: "TLS version",
      51: "key share"
    }[extensionType] ?? "unknown";
    h.comment(extensionTypeName);
    const [endExtension] = await h.expectLengthUint16("extension");
    switch (extensionType) {
      case 43:
        await h.expectUint16(772, "TLS version: 1.3");
        tlsVersionSpecified = true;
        break;
      case 51: {
        await h.expectUint16(23, "key share type: secp256r1 (NIST P-256)");
        const [endKeyShare, keyShareRemaining] = await h.expectLengthUint16("key share");
        const keyShareLength = keyShareRemaining();
        if (keyShareLength !== 65) throw new Error(`Expected 65 bytes of key share, but got ${keyShareLength}`);
        if (1) {
          await h.expectUint8(4, "legacy point format: always 4, which means uncompressed ([RFC 8446 \xA74.2.8.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.8.2) and [RFC 8422 \xA75.4.1](https://datatracker.ietf.org/doc/html/rfc8422#section-5.4.1))");
          const x = await h.readBytes(32);
          h.comment("x coordinate");
          const y = await h.readBytes(32);
          h.comment("y coordinate");
          serverPublicKey = concat([4], x, y);
        } else {
          serverPublicKey = await h.readBytes(keyShareLength);
        }
        endKeyShare();
        break;
      }
      default:
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
var keyOIDMap = {
  "1.2.840.10045.2.1": "ECPublicKey",
  "1.2.840.10045.3.1.7": "secp256r1",
  "1.3.132.0.34": "secp384r1",
  "1.2.840.113549.1.1.1": "RSAES-PKCS1-v1_5"
};
var extOIDMap = {
  "2.5.29.15": "KeyUsage",
  "2.5.29.37": "ExtKeyUsage",
  "2.5.29.19": "BasicConstraints",
  "2.5.29.30": "NameConstraints",
  "2.5.29.14": "SubjectKeyIdentifier",
  "2.5.29.35": "AuthorityKeyIdentifier",
  "1.3.6.1.5.5.7.1.1": "AuthorityInfoAccess",
  "2.5.29.17": "SubjectAltName",
  "2.5.29.32": "CertificatePolicies",
  "1.3.6.1.4.1.11129.2.4.2": "SignedCertificateTimestampList",
  "2.5.29.31": "CRLDistributionPoints (Certificate Revocation List)"
};
var extKeyUsageOIDMap = {
  "1.3.6.1.5.5.7.3.2": "TLSClientAuth",
  "1.3.6.1.5.5.7.3.1": "TLSServerAuth"
};
var extAccessMethodOIDMap = {
  "1.3.6.1.5.5.7.48.1": "OCSP",
  "1.3.6.1.5.5.7.48.2": "certificate authority issuers"
};
var certPolOIDMap = {
  "2.23.140.1.2.1": "domain validated",
  "2.23.140.1.2.2": "subject identity validated",
  "1.3.6.1.4.1.44947.1.1.1": "ISRG domain validated"
};
var certPolQualOIDMap = {
  "1.3.6.1.5.5.7.2.1": "Certificate Practice Statement"
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
    await cb.expectUint8(constructedUniversalTypeSet, "set");
    const [endItemSet] = await cb.expectASN1Length("set");
    const [endItemSeq] = await cb.expectASN1Sequence();
    const itemOID = await cb.readASN1OID();
    const itemName = DNOIDMap[itemOID] ?? itemOID;
    cb.comment(`= ${itemName}`);
    const valueType = await cb.readUint8();
    if (valueType === universalTypePrintableString) {
      cb.comment("printable string");
    } else if (valueType === universalTypeUTF8String) {
      cb.comment("UTF8 string");
    } else if (valueType === universalTypeIA5String) {
      cb.comment("IA5 string");
    } else if (valueType === universalTypeTeletexString) {
      cb.comment("Teletex string");
    } else {
      throw new Error(`Unexpected item type in certificate ${seqType}: 0x${hexFromU8([valueType])}`);
    }
    const [endItemString, itemStringRemaining] = await cb.expectASN1Length("UTF8 string");
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
  const [endNamesSeq, namesSeqRemaining] = await cb.expectASN1Sequence("names");
  while (namesSeqRemaining() > 0) {
    const type = await cb.readUint8("GeneralNames type");
    const [endName, nameRemaining] = await cb.expectASN1Length("name");
    let name;
    if (type === (typeUnionBits | 2 /* dNSName */)) {
      name = await cb.readUTF8String(nameRemaining());
      cb.comment("= DNS name");
    } else {
      name = await cb.readBytes(nameRemaining());
      cb.comment(`= name (type 0x${hexFromU8([type])})`);
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
function _descriptionForAlgorithm(algo, desc2 = []) {
  Object.values(algo).forEach((value) => {
    if (typeof value === "string") desc2 = [...desc2, value];
    else desc2 = _descriptionForAlgorithm(value, desc2);
  });
  return desc2;
}
function descriptionForAlgorithm(algo) {
  return _descriptionForAlgorithm(algo).join(" / ");
}

// src/util/asn1bytes.ts
var ASN1Bytes = class extends Bytes {
  async readASN1Length(comment) {
    const byte1 = await this.readUint8();
    if (byte1 < 128) {
      this.comment(`${byte1} bytes${comment ? ` of ${comment}` : ""} follow (ASN.1)`);
      return byte1;
    }
    const lengthBytes = byte1 & 127;
    const fullComment = `% bytes${comment ? ` of ${comment}` : ""} follow (ASN.1)`;
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
  async expectASN1TypeAndLength(typeNum, typeDesc, comment) {
    await this.expectUint8(typeNum, comment ? `${typeDesc}: ${comment}` : typeDesc);
    return this.expectASN1Length(typeDesc);
  }
  async readASN1OID(comment) {
    const [endOID, OIDRemaining] = await this.expectASN1TypeAndLength(universalTypeOID, "OID", comment);
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
    this.comment(oid);
    endOID();
    return oid;
  }
  async readASN1Boolean(comment) {
    const [endBoolean, booleanRemaining] = await this.expectASN1TypeAndLength(universalTypeBoolean, "boolean", comment);
    const length = booleanRemaining();
    if (length !== 1) throw new Error(`Boolean has unexpected length: ${length}`);
    const byte = await this.readUint8();
    const result = {
      255: true,
      0: false
    }[byte];
    if (result === void 0) throw new Error(`Boolean has unexpected value: 0x${hexFromU8([byte])}`);
    this.comment(String(result));
    endBoolean();
    return result;
  }
  async readASN1UTCTime(comment) {
    const [endTime, timeRemaining] = await this.expectASN1TypeAndLength(universalTypeUTCTime, "UTC time", comment);
    const timeStr = await this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
    if (!parts) throw new Error("Unrecognised ASN.1 UTC time format");
    const [, yr2dstr, mth, dy, hr, min, sec] = parts;
    const yr2d = parseInt(yr2dstr, 10);
    const yr = yr2d + (yr2d >= 50 ? 1900 : 2e3);
    const time = /* @__PURE__ */ new Date(`${yr}-${mth}-${dy}T${hr}:${min}:${sec}Z`);
    this.comment("= " + time.toISOString());
    endTime();
    return time;
  }
  async readASN1GeneralizedTime(comment) {
    const [endTime, timeRemaining] = await this.expectASN1TypeAndLength(universalTypeGeneralizedTime, "generalized time", comment);
    const timeStr = await this.readUTF8String(timeRemaining());
    const parts = timeStr.match(/^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})?([0-9]{2})?([.][0-9]+)?(Z)?([-+][0-9]+)?$/);
    if (!parts) throw new Error("Unrecognised ASN.1 generalized time format");
    const [, yr, mth, dy, hr, min, sec, fracsec, z, tz] = parts;
    if (sec === void 0 && fracsec !== void 0) throw new Error("Invalid ASN.1 generalized time format (fraction without seconds)");
    if (z !== void 0 && tz !== void 0) throw new Error("Invalid ASN.1 generalized time format (Z and timezone)");
    const time = /* @__PURE__ */ new Date(`${yr}-${mth}-${dy}T${hr}:${min ?? "00"}:${sec ?? "00"}${fracsec ?? ""}${tz ?? "Z"}`);
    this.comment("= " + time.toISOString());
    endTime();
    return time;
  }
  async readASN1Time(comment) {
    const startTimeType = await this.readUint8();
    this.offset--;
    let t;
    if (startTimeType === universalTypeUTCTime) {
      t = await this.readASN1UTCTime(comment);
    } else if (startTimeType === universalTypeGeneralizedTime) {
      t = await this.readASN1GeneralizedTime(comment);
    } else {
      throw new Error(`Expected time type but got 0x${hexFromU8([startTimeType])}`);
    }
    return t;
  }
  async readASN1BitString(comment) {
    const [endBitString, bitStringRemaining] = await this.expectASN1TypeAndLength(universalTypeBitString, "bitstring", comment);
    const rightPadBits = await this.readUint8("right-padding bits");
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
    comment && this.comment(comment);
    return bitString;
  }
  async expectASN1Sequence(comment) {
    return this.expectASN1TypeAndLength(constructedUniversalTypeSequence, "sequence", comment);
  }
  async expectASN1OctetString(comment) {
    return this.expectASN1TypeAndLength(universalTypeOctetString, "octet string", comment);
  }
  async expectASN1DERDoc() {
    return this.expectASN1OctetString("DER document");
  }
  async expectASN1Null(comment) {
    const [endNull] = await this.expectASN1TypeAndLength(universalTypeNull, "null", comment);
    endNull();
  }
};

// src/tls/sessionTicket.ts
async function parseSessionTicket(record) {
  const ticket = new Bytes(record);
  await ticket.expectUint8(4, "session ticket message, per [RFC 8846 \xA74.6.1](https://datatracker.ietf.org/doc/html/rfc8446#section-4.6.1) (we do nothing with these)");
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
  log(...highlightBytes(ticket.commentedString(), "#88c" /* server */));
}

// src/util/readQueue.ts
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
var LazyReadFunctionReadQueue = class extends ReadQueue {
  constructor(readFn) {
    super();
    this.readFn = readFn;
    __publicField(this, "dataIsExhausted", false);
  }
  async read(bytes, readMode = 0 /* CONSUME */) {
    const fetchPoints = [];
    while (this.bytesInQueue() < bytes) {
      fetchPoints.push(this.bytesInQueue());
      const data2 = await this.readFn();
      if (data2 === void 0) {
        this.dataIsExhausted = true;
        break;
      }
      if (data2.length > 0) this.enqueue(data2);
    }
    const data = await super.read(bytes, readMode);
    data.fetchPoints = fetchPoints;
    return data;
  }
  moreDataMayFollow() {
    return !this.dataIsExhausted;
  }
};

// src/tls/tlsRecordUtils.ts
var RecordTypeName = {
  [20 /* ChangeCipherSpec */]: "ChangeCipherSpec",
  [21 /* Alert */]: "Alert",
  [22 /* Handshake */]: "Handshake",
  [23 /* Application */]: "Application",
  [24 /* Heartbeat */]: "Heartbeat"
};
var AlertRecordLevelName = {
  1: "warning",
  2: "fatal"
};
var AlertRecordDescName = {
  0: "close_notify",
  10: "unexpected_message",
  20: "bad_record_mac",
  22: "record_overflow",
  40: "handshake_failure",
  42: "bad_certificate",
  43: "unsupported_certificate",
  44: "certificate_revoked",
  45: "certificate_expired",
  46: "certificate_unknown",
  47: "illegal_parameter",
  48: "unknown_ca",
  49: "access_denied",
  50: "decode_error",
  51: "decrypt_error",
  70: "protocol_version",
  71: "insufficient_security",
  80: "internal_error",
  86: "inappropriate_fallback",
  90: "user_canceled",
  109: "missing_extension",
  110: "unsupported_extension",
  112: "unrecognized_name",
  113: "bad_certificate_status_response",
  115: "unknown_psk_identity",
  116: "certificate_required",
  120: "no_application_protocol"
};

// src/tls/errors.ts
var TLSError = class extends Error {
  constructor(message) {
    super(message);
    __publicField(this, "name", "TLSError");
  }
};
var TLSFatalAlertError = class extends Error {
  constructor(message, alertCode) {
    super(message);
    this.alertCode = alertCode;
    __publicField(this, "name", "TLSFatalAlertError");
  }
};

// src/tls/tlsRecord.ts
var maxPlaintextRecordLength = 1 << 14;
var maxCiphertextRecordLength = maxPlaintextRecordLength + 1 + 255;
var tlsVersionNames = {
  771: "1.2 (or 1.3 for middlebox compatibility)",
  770: "1.1",
  769: "1.0"
};
async function readTlsRecord(read, expectedType, maxLength = maxPlaintextRecordLength) {
  const nextByte = await read(1, 1 /* PEEK */);
  if (nextByte === void 0) return;
  const record = new Bytes(read);
  const type = await record.readUint8();
  record.comment(`record type: ${RecordTypeName[type]}`);
  if (!(type in RecordTypeName)) throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  const tlsVersion = await record.readUint16();
  record.comment(`TLS version ${tlsVersionNames[tlsVersion] ?? "(invalid, or SSLv3 or earlier)"}`);
  const [, recordRemaining] = await record.expectLengthUint16("TLS record");
  const length = recordRemaining();
  if (length > maxLength) throw new Error(`Record too long: ${length} bytes`);
  let alertLevel, alertCode, alertDesc;
  if (type === 21 /* Alert */) {
    alertLevel = await record.readUint8("alert level:");
    record.comment(AlertRecordLevelName[alertLevel] ?? "unknown");
    alertCode = await record.readUint8("alert description:");
    alertDesc = AlertRecordDescName[alertCode];
    record.comment(alertDesc ?? "unknown");
  }
  log(...highlightBytes(record.commentedString(), type === 21 /* Alert */ ? "#c88" /* header */ : "#88c" /* server */));
  if (alertLevel === 2) {
    throw new TLSFatalAlertError(`Fatal TLS alert message received: ${alertDesc}`, alertCode ?? -1);
  } else if (alertLevel === 1) {
    return readTlsRecord(read, expectedType, maxLength);
  }
  if (tlsVersion !== 771) throw new TLSError(`Unsupported TLS version 0x${tlsVersion.toString(16)} in TLS record header`);
  if (expectedType !== void 0 && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, "0")} (expected 0x${expectedType.toString(16).padStart(2, "0")})`);
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
  await encryptedBytes.skipRead(encryptedRecord.length - 16, "encrypted payload");
  await encryptedBytes.skipRead(16, "auth tag");
  log(appendLog, ...highlightBytes(encryptedBytes.commentedString(), "#88c" /* server */));
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
    log(`%cTLS 0x15 alert record: ${hexFromU8(record, " ")}` + (closeNotify ? " (close notify)" : ""), `color: ${"#c88" /* header */}`);
    if (closeNotify) return void 0;
  }
  log("... decrypted payload (see below) ... %s%c  %s", type.toString(16).padStart(2, "0"), `color: ${"#88c" /* server */}`, `actual decrypted record type: ${RecordTypeName[type]}`);
  if (type === 22 /* Handshake */ && record[0] === 4) {
    await parseSessionTicket(record);
    return readEncryptedTlsRecord(read, decrypter, expectedType);
  }
  if (expectedType !== void 0 && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, "0")} (expected 0x${expectedType.toString(16).padStart(2, "0")})`);
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
  encryptedRecord.writeUint8(23, "record type: Application (middlebox compatibility)");
  encryptedRecord.writeUint16(771, "TLS version 1.2 (middlebox compatibility)");
  encryptedRecord.writeUint16(payloadLength, `${payloadLength} bytes follow`);
  const [endEncryptedRecord] = encryptedRecord.expectWriteLength(payloadLength);
  const header = encryptedRecord.array();
  const encryptedData = await encrypter.process(data, 16, header);
  encryptedRecord.writeBytes(encryptedData.subarray(0, encryptedData.length - 16));
  encryptedRecord.comment("encrypted data");
  encryptedRecord.writeBytes(encryptedData.subarray(encryptedData.length - 16));
  encryptedRecord.comment("auth tag");
  endEncryptedRecord();
  log(...highlightBytes(encryptedRecord.commentedString(), "#8cc" /* client */));
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
var subtleCrypto = typeof crypto !== "undefined" && crypto.subtle !== void 0 ? Promise.resolve(crypto.subtle) : (
  // browsers and Node 19+
  import("crypto").then((c2) => c2.webcrypto.subtle)
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
  const hmacKey = await cryptoProxy_default.importKey("raw", salt, { name: "HMAC", hash: { name: `SHA-${hashBits}` } }, false, ["sign"]);
  const prk = new Uint8Array(await cryptoProxy_default.sign("HMAC", hmacKey, keyMaterial));
  return prk;
}
async function hkdfExpand(key, info, length, hashBits) {
  const hashBytes = hashBits >> 3;
  const n = Math.ceil(length / hashBytes);
  const okm = new Uint8Array(n * hashBytes);
  const hmacKey = await cryptoProxy_default.importKey("raw", key, { name: "HMAC", hash: { name: `SHA-${hashBits}` } }, false, ["sign"]);
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
  const publicKey = await cryptoProxy_default.importKey("raw", serverPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecretBuffer = await cryptoProxy_default.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  log(...highlightColonList("shared secret (via ECDH): " + hexFromU8(sharedSecret)));
  const hellosHashBuffer = await cryptoProxy_default.digest("SHA-256", hellos);
  const hellosHash = new Uint8Array(hellosHashBuffer);
  log(...highlightColonList("hellos hash: " + hexFromU8(hellosHash)));
  const earlySecret = await hkdfExtract(new Uint8Array(1), zeroKey, hashBits);
  log(...highlightColonList("early secret: " + hexFromU8(new Uint8Array(earlySecret))));
  const emptyHashBuffer = await cryptoProxy_default.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  log(...highlightColonList("empty hash: " + hexFromU8(emptyHash)));
  const derivedSecret = await hkdfExpandLabel(earlySecret, "derived", emptyHash, hashBytes, hashBits);
  log(...highlightColonList("derived secret: " + hexFromU8(derivedSecret)));
  const handshakeSecret = await hkdfExtract(derivedSecret, sharedSecret, hashBits);
  log(...highlightColonList("handshake secret: " + hexFromU8(handshakeSecret)));
  const clientSecret = await hkdfExpandLabel(handshakeSecret, "c hs traffic", hellosHash, hashBytes, hashBits);
  log(...highlightColonList("client secret: " + hexFromU8(clientSecret)));
  const serverSecret = await hkdfExpandLabel(handshakeSecret, "s hs traffic", hellosHash, hashBytes, hashBits);
  log(...highlightColonList("server secret: " + hexFromU8(serverSecret)));
  const clientHandshakeKey = await hkdfExpandLabel(clientSecret, "key", new Uint8Array(0), keyLength, hashBits);
  log(...highlightColonList("client handshake key: " + hexFromU8(clientHandshakeKey)));
  const serverHandshakeKey = await hkdfExpandLabel(serverSecret, "key", new Uint8Array(0), keyLength, hashBits);
  log(...highlightColonList("server handshake key: " + hexFromU8(serverHandshakeKey)));
  const clientHandshakeIV = await hkdfExpandLabel(clientSecret, "iv", new Uint8Array(0), 12, hashBits);
  log(...highlightColonList("client handshake iv: " + hexFromU8(clientHandshakeIV)));
  const serverHandshakeIV = await hkdfExpandLabel(serverSecret, "iv", new Uint8Array(0), 12, hashBits);
  log(...highlightColonList("server handshake iv: " + hexFromU8(serverHandshakeIV)));
  return { serverHandshakeKey, serverHandshakeIV, clientHandshakeKey, clientHandshakeIV, handshakeSecret, clientSecret, serverSecret };
}
async function getApplicationKeys(handshakeSecret, handshakeHash, hashBits, keyLength) {
  const hashBytes = hashBits >>> 3;
  const zeroKey = new Uint8Array(hashBytes);
  const emptyHashBuffer = await cryptoProxy_default.digest(`SHA-${hashBits}`, new Uint8Array(0));
  const emptyHash = new Uint8Array(emptyHashBuffer);
  log(...highlightColonList("empty hash: " + hexFromU8(emptyHash)));
  const derivedSecret = await hkdfExpandLabel(handshakeSecret, "derived", emptyHash, hashBytes, hashBits);
  log(...highlightColonList("derived secret: " + hexFromU8(derivedSecret)));
  const masterSecret = await hkdfExtract(derivedSecret, zeroKey, hashBits);
  log(...highlightColonList("master secret: " + hexFromU8(masterSecret)));
  const clientSecret = await hkdfExpandLabel(masterSecret, "c ap traffic", handshakeHash, hashBytes, hashBits);
  log(...highlightColonList("client secret: " + hexFromU8(clientSecret)));
  const serverSecret = await hkdfExpandLabel(masterSecret, "s ap traffic", handshakeHash, hashBytes, hashBits);
  log(...highlightColonList("server secret: " + hexFromU8(serverSecret)));
  const clientApplicationKey = await hkdfExpandLabel(clientSecret, "key", new Uint8Array(0), keyLength, hashBits);
  log(...highlightColonList("client application key: " + hexFromU8(clientApplicationKey)));
  const serverApplicationKey = await hkdfExpandLabel(serverSecret, "key", new Uint8Array(0), keyLength, hashBits);
  log(...highlightColonList("server application key: " + hexFromU8(serverApplicationKey)));
  const clientApplicationIV = await hkdfExpandLabel(clientSecret, "iv", new Uint8Array(0), 12, hashBits);
  log(...highlightColonList("client application iv: " + hexFromU8(clientApplicationIV)));
  const serverApplicationIV = await hkdfExpandLabel(serverSecret, "iv", new Uint8Array(0), 12, hashBits);
  log(...highlightColonList("server application iv: " + hexFromU8(serverApplicationIV)));
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
      ([k, vs]) => typeof vs === "string" ? `${k}=${vs.trim().replace(/[\\,]/g, "\\$&")}` : vs.map((v) => `${k}=${v.trim().replace(/[\\,]/g, "\\$&")}`).join(", ")
    ).join(", ");
  }
  static async create(certData) {
    const cert = Object.create(this.prototype);
    if (certData instanceof ASN1Bytes || certData instanceof Uint8Array) {
      const cb = certData instanceof ASN1Bytes ? certData : new ASN1Bytes(certData);
      const certSeqStartOffset = cb.offset;
      const [endCertSeq] = await cb.expectASN1Sequence("certificate");
      const tbsCertStartOffset = cb.offset;
      const [endCertInfoSeq] = await cb.expectASN1Sequence("certificate info");
      await cb.expectBytes([160, 3, 2, 1, 2], "certificate version 3");
      await cb.expectUint8(universalTypeInteger, "integer: serial number");
      const [endSerialNumber, serialNumberRemaining] = await cb.expectASN1Length("integer");
      cert.serialNumber = await cb.subarrayForRead(serialNumberRemaining());
      cb.comment("serial number");
      endSerialNumber();
      const [endAlgo, algoRemaining] = await cb.expectASN1Sequence("algorithm");
      cert.algorithm = await cb.readASN1OID();
      cb.comment(`= ${descriptionForAlgorithm(algorithmWithOID(cert.algorithm))}`);
      if (algoRemaining() > 0) {
        await cb.expectASN1Null("no algorithm parameters");
      }
      endAlgo();
      cert.issuer = await readSeqOfSetOfSeq(cb, "issuer");
      const [endValiditySeq] = await cb.expectASN1Sequence("validity");
      const notBefore = await cb.readASN1Time("not valid before");
      const notAfter = await cb.readASN1Time("not valid after");
      cert.validityPeriod = { notBefore, notAfter };
      endValiditySeq();
      cert.subject = await readSeqOfSetOfSeq(cb, "subject");
      const publicKeyStartOffset = cb.offset;
      const [endPublicKeySeq] = await cb.expectASN1Sequence("public key");
      const [endKeyOID, keyOIDRemaining] = await cb.expectASN1Sequence("public key params");
      const publicKeyOIDs = [];
      while (keyOIDRemaining() > 0) {
        const keyParamRecordType = await cb.readUint8();
        cb.offset--;
        if (keyParamRecordType === universalTypeOID) {
          const keyOID = await cb.readASN1OID();
          cb.comment(`= ${keyOIDMap[keyOID]}`);
          publicKeyOIDs.push(keyOID);
        } else if (keyParamRecordType === universalTypeNull) {
          await cb.expectASN1Null();
        }
      }
      endKeyOID();
      const publicKeyData = await cb.readASN1BitString();
      cb.comment("public key");
      cert.publicKey = { identifiers: publicKeyOIDs, data: publicKeyData, all: cb.data.subarray(publicKeyStartOffset, cb.offset) };
      endPublicKeySeq();
      await cb.expectUint8(constructedContextSpecificType, "constructed context-specific type: extensions");
      const [endExtsData] = await cb.expectASN1Length();
      const [endExts, extsRemaining] = await cb.expectASN1Sequence("certificate extensions");
      while (extsRemaining() > 0) {
        const [endExt, extRemaining] = await cb.expectASN1Sequence("certificate extension");
        const extOID = await cb.readASN1OID("extension type");
        cb.comment(`= ${extOIDMap[extOID]}`);
        if (extOID === "2.5.29.17") {
          const [endSanDerDoc] = await cb.expectASN1DERDoc();
          const allSubjectAltNames = await readNamesSeq(cb, contextSpecificType);
          cert.subjectAltNames = allSubjectAltNames.filter((san) => san.type === (2 /* dNSName */ | contextSpecificType)).map((san) => san.name);
          endSanDerDoc();
        } else if (extOID === "2.5.29.15") {
          let keyUsageCritical;
          let nextType = await cb.readUint8();
          cb.offset--;
          if (nextType === universalTypeBoolean) {
            keyUsageCritical = await cb.readASN1Boolean("critical");
            nextType = await cb.readUint8();
            cb.offset--;
          }
          const [endKeyUsageDer] = await cb.expectASN1DERDoc();
          const keyUsageBitStr = await cb.readASN1BitString();
          const keyUsageBitmask = intFromBitString(keyUsageBitStr);
          const keyUsageNames = new Set(allKeyUsages.filter((u, i) => keyUsageBitmask & 1 << i));
          cb.comment(`key usage: ${keyUsageBitmask} = ${[...keyUsageNames].join(", ")}`);
          endKeyUsageDer();
          cert.keyUsage = {
            critical: keyUsageCritical,
            usages: keyUsageNames
          };
        } else if (extOID === "2.5.29.37") {
          cert.extKeyUsage = {};
          const [endExtKeyUsageDer] = await cb.expectASN1DERDoc();
          const [endExtKeyUsage, extKeyUsageRemaining] = await cb.expectASN1Sequence("key usage OIDs");
          while (extKeyUsageRemaining() > 0) {
            const extKeyUsageOID = await cb.readASN1OID();
            cb.comment(`= ${extKeyUsageOIDMap[extKeyUsageOID]}`);
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
              cb.comment("context-specific type: key identifier");
              const [endAuthKeyId, authKeyIdRemaining] = await cb.expectASN1Length("authority key identifier");
              cert.authorityKeyIdentifier = await cb.readBytes(authKeyIdRemaining());
              cb.comment("authority key identifier");
              endAuthKeyId();
            } else if (authKeyIdDatumType === (contextSpecificType | 1)) {
              cb.comment("context-specific type: authority cert issuer");
              const [endAuthKeyIdCertIssuer, authKeyIdCertIssuerRemaining] = await cb.expectASN1Length("authority cert issuer");
              await cb.skipRead(authKeyIdCertIssuerRemaining(), "ignored");
              endAuthKeyIdCertIssuer();
            } else if (authKeyIdDatumType === (contextSpecificType | 2)) {
              cb.comment("context-specific type: authority cert serial number");
              const [endAuthKeyIdCertSerialNo, authKeyIdCertSerialNoRemaining] = await cb.expectASN1Length("authority cert issuer or authority cert serial number");
              await cb.skipRead(authKeyIdCertSerialNoRemaining(), "ignored");
              endAuthKeyIdCertSerialNo();
            } else if (authKeyIdDatumType === (contextSpecificType | 33)) {
              cb.comment("context-specific type: DirName");
              const [endDirName, dirNameRemaining] = await cb.expectASN1Length("DirName");
              await cb.skipRead(dirNameRemaining(), "ignored");
              console.log(cb.commentedString());
              endDirName();
            } else {
              throw new Error(`Unexpected data type ${authKeyIdDatumType} in authorityKeyIdentifier certificate extension`);
            }
          }
          endAuthKeyIdSeq();
          endAuthKeyIdDer();
        } else if (extOID === "2.5.29.14") {
          const [endSubjectKeyIdDer] = await cb.expectASN1DERDoc();
          const [endSubjectKeyId, subjectKeyIdRemaining] = await cb.expectASN1OctetString("subject key identifier");
          cert.subjectKeyIdentifier = await cb.readBytes(subjectKeyIdRemaining());
          cb.comment("subject key identifier");
          endSubjectKeyId();
          endSubjectKeyIdDer();
        } else if (extOID === "2.5.29.19") {
          let basicConstraintsCritical;
          let bcNextType = await cb.readUint8();
          cb.offset--;
          if (bcNextType === universalTypeBoolean) {
            basicConstraintsCritical = await cb.readASN1Boolean("critical");
            bcNextType = await cb.readUint8();
            cb.offset--;
          }
          const [endBasicConstraintsDer] = await cb.expectASN1DERDoc();
          const [endConstraintsSeq, constraintsSeqRemaining] = await cb.expectASN1Sequence();
          let basicConstraintsCa = void 0;
          if (constraintsSeqRemaining() > 0) {
            basicConstraintsCa = await cb.readASN1Boolean("certificate authority");
          }
          let basicConstraintsPathLength;
          if (constraintsSeqRemaining() > 0) {
            await cb.expectUint8(universalTypeInteger, "integer: max path length");
            const maxPathLengthLength = await cb.readASN1Length("integer");
            basicConstraintsPathLength = maxPathLengthLength === 1 ? await cb.readUint8() : maxPathLengthLength === 2 ? await cb.readUint16() : maxPathLengthLength === 3 ? await cb.readUint24() : void 0;
            if (basicConstraintsPathLength === void 0) throw new Error("Too many bytes in max path length in certificate basicConstraints");
            cb.comment("max path length");
          }
          endConstraintsSeq();
          endBasicConstraintsDer();
          cert.basicConstraints = {
            critical: basicConstraintsCritical,
            ca: basicConstraintsCa,
            pathLength: basicConstraintsPathLength
          };
        } else if (extOID === "1.3.6.1.5.5.7.1.1") {
          const [endAuthInfoAccessDER] = await cb.expectASN1DERDoc();
          const [endAuthInfoAccessSeq, authInfoAccessSeqRemaining] = await cb.expectASN1Sequence();
          while (authInfoAccessSeqRemaining() > 0) {
            const [endAuthInfoAccessInnerSeq] = await cb.expectASN1Sequence();
            const accessMethodOID = await cb.readASN1OID();
            cb.comment(`= access method: ${extAccessMethodOIDMap[accessMethodOID] ?? "unknown method"} `);
            await cb.expectUint8(contextSpecificType | 6 /* uniformResourceIdentifier */, "context-specific type: URI");
            const [endMethodURI, methodURIRemaining] = await cb.expectASN1Length("access location");
            await cb.readUTF8String(methodURIRemaining());
            endMethodURI();
            endAuthInfoAccessInnerSeq();
          }
          endAuthInfoAccessSeq();
          endAuthInfoAccessDER();
        } else if (extOID === "2.5.29.32") {
          const [endCertPolDER] = await cb.expectASN1DERDoc();
          const [endCertPolSeq, certPolSeqRemaining] = await cb.expectASN1Sequence();
          while (certPolSeqRemaining() > 0) {
            const [endCertPolInnerSeq, certPolInnerSeqRemaining] = await cb.expectASN1Sequence();
            const certPolOID = await cb.readASN1OID("CertPolicyID");
            cb.comment(`= policy: ${certPolOIDMap[certPolOID] ?? "unknown policy"} `);
            while (certPolInnerSeqRemaining() > 0) {
              const [endCertPolInner2Seq, certPolInner2SeqRemaining] = await cb.expectASN1Sequence();
              while (certPolInner2SeqRemaining() > 0) {
                const [endCertPolInner3Seq, certPolInner3SeqRemaining] = await cb.expectASN1Sequence();
                const certPolQualOID = await cb.readASN1OID("policyQualifierId");
                cb.comment(`= qualifier: ${certPolQualOIDMap[certPolQualOID] ?? "unknown qualifier"} `);
                const qualType = await cb.readUint8();
                if (qualType === universalTypeIA5String) {
                  cb.comment("IA5String");
                  const [endQualStr, qualStrRemaining] = await cb.expectASN1Length("string");
                  await cb.readUTF8String(qualStrRemaining());
                  endQualStr();
                } else {
                  if (certPolInner3SeqRemaining()) await cb.skipRead(certPolInner3SeqRemaining(), "skipped policy qualifier data");
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
          await cb.skipRead(extRemaining(), "ignored extension data");
        }
        endExt();
      }
      endExts();
      endExtsData();
      endCertInfoSeq();
      cert.signedData = cb.data.subarray(tbsCertStartOffset, cb.offset);
      const [endSigAlgo, sigAlgoRemaining] = await cb.expectASN1Sequence("signature algorithm");
      const sigAlgoOID = await cb.readASN1OID("must be same as algorithm in certificate above");
      if (sigAlgoRemaining() > 0) {
        await cb.expectASN1Null("no algorithm parameters");
      }
      endSigAlgo();
      if (sigAlgoOID !== cert.algorithm) throw new Error(`Certificate specifies different signature algorithms inside (${cert.algorithm}) and out (${sigAlgoOID})`);
      cert.signature = await cb.readASN1BitString("signature");
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
    return "subject: " + _Cert.stringFromDistinguishedName(this.subject) + (this.subjectAltNames ? "\nsubject alt names: " + this.subjectAltNames.join(", ") : "") + (this.subjectKeyIdentifier ? `
subject key id: ${hexFromU8(this.subjectKeyIdentifier)}` : "") + "\nissuer: " + _Cert.stringFromDistinguishedName(this.issuer) + (this.authorityKeyIdentifier ? `
authority key id: ${hexFromU8(this.authorityKeyIdentifier)}` : "") + "\nvalidity: " + this.validityPeriod.notBefore.toISOString() + " \u2014 " + this.validityPeriod.notAfter.toISOString() + ` (${this.isValidAtMoment() ? "currently valid" : "not valid"})` + (this.keyUsage ? `
key usage (${this.keyUsage.critical ? "critical" : "non-critical"}): ` + [...this.keyUsage.usages].join(", ") : "") + (this.extKeyUsage ? `
extended key usage: TLS server \u2014 ${this.extKeyUsage.serverTls}, TLS client \u2014 ${this.extKeyUsage.clientTls}` : "") + (this.basicConstraints ? `
basic constraints (${this.basicConstraints.critical ? "critical" : "non-critical"}): CA \u2014 ${this.basicConstraints.ca}, path length \u2014 ${this.basicConstraints.pathLength}` : "") + "\nsignature algorithm: " + descriptionForAlgorithm(algorithmWithOID(this.algorithm));
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
    const key = typeof subjectOrSubjectKeyId === "string" ? subjectOrSubjectKeyId : Cert.stringFromDistinguishedName(subjectOrSubjectKeyId);
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
  await sb.expectUint8(universalTypeInteger, "integer: signature \u2014 r");
  const [endSigRBytes, sigRBytesRemaining] = await sb.expectASN1Length("integer");
  const sigR = await sb.readBytes(sigRBytesRemaining());
  sb.comment("signature \u2014 r");
  endSigRBytes();
  await sb.expectUint8(universalTypeInteger, "integer: signature \u2014 s");
  const [endSigSBytes, sigSBytesRemaining] = await sb.expectASN1Length("integer");
  const sigS = await sb.readBytes(sigSBytesRemaining());
  sb.comment("signature \u2014 s");
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
  const signatureKey = await cryptoProxy_default.importKey("spki", publicKey, { name: "ECDSA", namedCurve }, false, ["verify"]);
  const certVerifyResult = await cryptoProxy_default.verify({ name: "ECDSA", hash }, signatureKey, signature, signedData);
  if (certVerifyResult !== true) throw new Error("ECDSA certificate verify failed");
  log(`%c\u2713 ECDSA signature verified (curve ${namedCurve}, hash ${hash})`, "color: #8c8;");
}

// src/tls/verifyCerts.ts
function stringFromCN(cn) {
  return typeof cn === "string" ? cn : cn.join(", ");
}
async function verifyCerts(host, certs, rootCertsDatabase, requireServerTlsExtKeyUsage = true, requireDigitalSigKeyUsage = true) {
  log("%c%s", `color: ${"#c88" /* header */}`, "certificates received from host");
  for (const cert of certs) log(...highlightColonList(cert.description()));
  log("Now we have all the certificates, which are summarised above. First, we do some basic checks on the end-user certificate \u2014\xA0i.e. the one this server is presenting as its own ([source](https://github.com/jawj/subtls/blob/main/src/tls/verifyCerts.ts)):");
  const userCert = certs[0];
  const matchingSubjectAltName = userCert.subjectAltNameMatchingHost(host);
  if (matchingSubjectAltName === void 0) throw new Error(`No matching subjectAltName for ${host}`);
  log(`%c\u2713 matched host to subjectAltName "${matchingSubjectAltName}"`, "color: #8c8;");
  const validNow = userCert.isValidAtMoment();
  if (!validNow) throw new Error("End-user certificate is not valid now");
  log("%c\u2713 end-user certificate is valid now", "color: #8c8;");
  if (requireServerTlsExtKeyUsage) {
    if (!userCert.extKeyUsage?.serverTls) throw new Error("End-user certificate has no TLS server extKeyUsage");
    log("%c\u2713 end-user certificate has TLS server extKeyUsage", "color: #8c8;");
  }
  log("Next, we verify the signature of each certificate using the public key of the next certificate in the chain. This carries on until we find a certificate we can verify using one of our own trusted root certificates (or until we reach the end of the chain and therefore fail):");
  let verifiedToTrustedRoot = false;
  log("%c%s", `color: ${"#c88" /* header */}`, `trusted root certificates in store: ${rootCertsDatabase.index.offsets.length - 1} ([from Mozilla](https://curl.se/docs/caextract.html))`);
  for (let i = 0, len = certs.length; i < len; i++) {
    const subjectCert = certs[i];
    const subjectAuthKeyId = subjectCert.authorityKeyIdentifier;
    let signingCert;
    if (subjectAuthKeyId === void 0) {
      signingCert = await TrustedCert.findInDatabase(subjectCert.issuer, rootCertsDatabase);
      signingCert && log("matched a trusted root cert on subject/issuer distinguished name: %s", Cert.stringFromDistinguishedName(signingCert.subject));
    } else {
      signingCert = await TrustedCert.findInDatabase(hexFromU8(subjectAuthKeyId), rootCertsDatabase);
      signingCert && log("matched a trusted root cert on key id: %s", hexFromU8(subjectAuthKeyId));
    }
    if (signingCert !== void 0) {
      log("%c%s", `color: ${"#c88" /* header */}`, "trusted root certificate");
      signingCert && log(...highlightColonList(signingCert.description()));
    }
    if (signingCert === void 0) signingCert = certs[i + 1];
    if (signingCert === void 0) throw new Error("Ran out of certificates without reaching a trusted root");
    const signingCertIsTrustedRoot = signingCert instanceof TrustedCert;
    log(`checking ${signingCertIsTrustedRoot ? "trusted root" : "intermediate"} signing certificate CN "${stringFromCN(signingCert.subject.CN)}" ...`);
    if (signingCert.isValidAtMoment() !== true) throw new Error("Signing certificate is not valid now");
    log("%c\u2713 certificate is valid now", "color: #8c8;");
    if (requireDigitalSigKeyUsage) {
      if (signingCert.keyUsage?.usages.has("digitalSignature") !== true) throw new Error("Signing certificate keyUsage does not include digital signatures");
      log("%c\u2713 certificate keyUsage includes digital signatures", "color: #8c8;");
    }
    if (signingCert.basicConstraints?.ca !== true) throw new Error("Signing certificate basicConstraints do not indicate a CA certificate");
    log("%c\u2713 certificate basicConstraints indicate a CA certificate", "color: #8c8;");
    const { pathLength } = signingCert.basicConstraints;
    if (pathLength === void 0) {
      log("%c\u2713 certificate pathLength is not constrained", "color: #8c8;");
    } else {
      if (pathLength < i) throw new Error("Exceeded certificate pathLength");
      log("%c\u2713 certificate pathLength is not exceeded", "color: #8c8;");
    }
    log(
      `verifying certificate CN "${stringFromCN(subjectCert.subject.CN)}" is signed by %c${signingCertIsTrustedRoot ? "trusted root" : "intermediate"}%c certificate CN "${stringFromCN(signingCert.subject.CN)}" ...`,
      `background: ${signingCertIsTrustedRoot ? "#ffc" : "#eee"}`,
      "background: inherit"
    );
    if (subjectCert.algorithm === "1.2.840.10045.4.3.2" || subjectCert.algorithm === "1.2.840.10045.4.3.3") {
      const hash = subjectCert.algorithm === "1.2.840.10045.4.3.2" ? "SHA-256" : "SHA-384";
      const signingKeyOIDs = signingCert.publicKey.identifiers;
      const namedCurve = signingKeyOIDs.includes("1.2.840.10045.3.1.7") ? "P-256" : signingKeyOIDs.includes("1.3.132.0.34") ? "P-384" : void 0;
      if (namedCurve === void 0) throw new Error("Unsupported signing key curve");
      const sb = new ASN1Bytes(subjectCert.signature);
      await ecdsaVerify(sb, signingCert.publicKey.all, subjectCert.signedData, namedCurve, hash);
    } else if (subjectCert.algorithm === "1.2.840.113549.1.1.11" || subjectCert.algorithm === "1.2.840.113549.1.1.12") {
      const hash = subjectCert.algorithm === "1.2.840.113549.1.1.11" ? "SHA-256" : "SHA-384";
      const signatureKey = await cryptoProxy_default.importKey("spki", signingCert.publicKey.all, { name: "RSASSA-PKCS1-v1_5", hash }, false, ["verify"]);
      const certVerifyResult = await cryptoProxy_default.verify({ name: "RSASSA-PKCS1-v1_5" }, signatureKey, subjectCert.signature, subjectCert.signedData);
      if (certVerifyResult !== true) throw new Error("RSASSA_PKCS1-v1_5-SHA256 certificate verify failed");
      log("%c\u2713 RSASAA-PKCS1-v1_5 signature verified", "color: #8c8;");
    } else {
      throw new Error("Unsupported signing algorithm");
    }
    if (signingCertIsTrustedRoot) {
      log("%c\u2713 chain of trust validated back to a trusted root", "color: #8c8;");
      verifiedToTrustedRoot = true;
      break;
    }
  }
  return verifiedToTrustedRoot;
}

// src/tls/parseEncryptedHandshake.ts
var txtEnc3 = new TextEncoder();
async function parseEncryptedHandshake(host, hs, serverSecret, hellos, rootCertsDatabase, requireServerTlsExtKeyUsage = true, requireDigitalSigKeyUsage = true) {
  let protocolFromALPN = void 0;
  await hs.expectUint8(8, "handshake record type: encrypted extensions ([RFC 8446 \xA74.3.1](https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.1))");
  const [eeMessageEnd] = await hs.expectLengthUint24();
  const [extEnd, extRemaining] = await hs.expectLengthUint16("extensions");
  while (extRemaining() > 0) {
    const extType = await hs.readUint16("extension type:");
    switch (extType) {
      case 0:
        hs.comment("SNI");
        await hs.expectUint16(0, "no extension data ([RFC 6066 \xA73](https://datatracker.ietf.org/doc/html/rfc6066#section-3))");
        break;
      case 16: {
        hs.comment("ALPN");
        const [endALPN] = await hs.expectLengthUint16("ALPN data");
        const [endProtocols] = await hs.expectLengthUint16("protocols (but there can be only one)");
        const [endProtocol, protocolRemaining] = await hs.expectLengthUint8("protocol");
        protocolFromALPN = await hs.readUTF8String(protocolRemaining());
        endProtocol();
        endProtocols();
        endALPN();
        break;
      }
      case 10: {
        hs.comment("supported groups ([RFC 8446 \xA74.2](https://www.rfc-editor.org/rfc/rfc8446#section-4.2), [\xA74.2.7](https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7))");
        const [endGroupsData] = await hs.expectLengthUint16("groups data");
        const [endGroups, groupsRemaining] = await hs.expectLengthUint16("groups");
        hs.comment("(most preferred first)");
        while (groupsRemaining() > 0) {
          const group = await hs.readUint16();
          if (1) {
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
        break;
      }
      default:
        throw new Error(`Unsupported server encrypted extension type 0x${hexFromU8([extType]).padStart(4, "0")}`);
    }
  }
  extEnd();
  eeMessageEnd();
  let clientCertRequested = false;
  let certMsgType = await hs.readUint8();
  if (certMsgType === 13) {
    hs.comment("handshake record type: certificate request ([RFC 8446 \xA74.3.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.3.2))");
    clientCertRequested = true;
    const [endCertReq] = await hs.expectLengthUint24("certificate request data");
    await hs.expectUint8(0, "length of certificate request context");
    const [endCertReqExts, certReqExtsRemaining] = await hs.expectLengthUint16("certificate request extensions");
    await hs.skipRead(certReqExtsRemaining(), "certificate request extensions (ignored)");
    endCertReqExts();
    endCertReq();
    certMsgType = await hs.readUint8();
  }
  if (certMsgType !== 11) throw new Error(`Unexpected handshake message type 0x${hexFromU8([certMsgType])}`);
  hs.comment("handshake record type: certificate ([RFC 8446 \xA74.4.2](https://datatracker.ietf.org/doc/html/rfc8446#section-4.4.2))");
  const [endCertPayload] = await hs.expectLengthUint24("certificate payload");
  await hs.expectUint8(0, "no bytes of request context follow");
  const [endCerts, certsRemaining] = await hs.expectLengthUint24("certificates");
  const certs = [];
  while (certsRemaining() > 0) {
    const [endCert] = await hs.expectLengthUint24("certificate");
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
  const certVerifySignedData = concat(txtEnc3.encode(" ".repeat(64) + "TLS 1.3, server CertificateVerify"), [0], certVerifyHash);
  await hs.expectUint8(15, "handshake message type: certificate verify ([RFC 8446 \xA74.4.3](https://datatracker.ietf.org/doc/html/rfc8446#section-4.4.3))");
  const [endCertVerifyPayload] = await hs.expectLengthUint24("handshake message data");
  const sigType = await hs.readUint16();
  log("verifying end-user certificate ...");
  if (sigType === 1027) {
    hs.comment("signature type ECDSA-SECP256R1-SHA256");
    const [endSignature] = await hs.expectLengthUint16();
    await ecdsaVerify(hs, userCert.publicKey.all, certVerifySignedData, "P-256", "SHA-256");
    endSignature();
  } else if (sigType === 2052) {
    hs.comment("signature type RSA-PSS-RSAE-SHA256");
    const [endSignature, signatureRemaining] = await hs.expectLengthUint16();
    const signature = await hs.subarrayForRead(signatureRemaining());
    hs.comment("signature");
    endSignature();
    const signatureKey = await cryptoProxy_default.importKey("spki", userCert.publicKey.all, { name: "RSA-PSS", hash: "SHA-256" }, false, ["verify"]);
    const certVerifyResult = await cryptoProxy_default.verify({
      name: "RSA-PSS",
      saltLength: 32
      /* SHA-256 length in bytes */
    }, signatureKey, signature, certVerifySignedData);
    if (certVerifyResult !== true) throw new Error("RSA-PSS-RSAE-SHA256 certificate verify failed");
  } else {
    throw new Error(`Unsupported certificate verify signature type 0x${hexFromU8([sigType]).padStart(4, "0")}`);
  }
  log("%c\u2713 end-user certificate verified (server has private key)", "color: #8c8;");
  endCertVerifyPayload();
  const verifyHandshakeData = hs.data.subarray(0, hs.offset);
  const verifyData = concat(hellos, verifyHandshakeData);
  const finishedKey = await hkdfExpandLabel(serverSecret, "finished", new Uint8Array(0), 32, 256);
  const finishedHash = await cryptoProxy_default.digest("SHA-256", verifyData);
  const hmacKey = await cryptoProxy_default.importKey("raw", finishedKey, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
  const correctVerifyHashBuffer = await cryptoProxy_default.sign("HMAC", hmacKey, finishedHash);
  const correctVerifyHash = new Uint8Array(correctVerifyHashBuffer);
  await hs.expectUint8(20, "handshake message type: finished ([RFC 8446 \xA74.4.4](https://datatracker.ietf.org/doc/html/rfc8446#section-4.4.4))");
  const [endHsFinishedPayload, hsFinishedPayloadRemaining] = await hs.expectLengthUint24("verify hash");
  const verifyHash = await hs.readBytes(hsFinishedPayloadRemaining());
  hs.comment("verify hash");
  endHsFinishedPayload();
  if (hs.readRemaining() !== 0) throw new Error("Unexpected extra bytes in server handshake");
  const verifyHashVerified = equal(verifyHash, correctVerifyHash);
  if (verifyHashVerified !== true) throw new Error("Invalid server verify hash");
  log("Decrypted using the server handshake key, the server\u2019s handshake messages are parsed as follows ([source](https://github.com/jawj/subtls/blob/main/src/tls/readEncryptedHandshake.ts)). This is a long section, since X.509 certificates are quite complex and there will be several of them:");
  log(...highlightBytes(hs.commentedString(), "#88c" /* server */));
  const verifiedToTrustedRoot = await verifyCerts(host, certs, rootCertsDatabase, requireServerTlsExtKeyUsage, requireDigitalSigKeyUsage);
  if (!verifiedToTrustedRoot) throw new Error("Validated certificate chain did not end in a trusted root");
  return { handshakeData: hs.data.subarray(0, hs.offset), clientCertRequested, userCert, protocolFromALPN };
}

// src/tls/startTls.ts
async function startTls(host, rootCertsDatabase, networkRead, networkWrite, { useSNI, protocolsForALPN, requireServerTlsExtKeyUsage, requireDigitalSigKeyUsage, writePreData, expectPreData, commentPreData } = {}) {
  useSNI ?? (useSNI = true);
  requireServerTlsExtKeyUsage ?? (requireServerTlsExtKeyUsage = true);
  requireDigitalSigKeyUsage ?? (requireDigitalSigKeyUsage = true);
  if (typeof rootCertsDatabase === "string") rootCertsDatabase = await TrustedCert.databaseFromPEM(rootCertsDatabase);
  const ecdhKeys = await cryptoProxy_default.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const rawPublicKeyBuffer = await cryptoProxy_default.exportKey("raw", ecdhKeys.publicKey);
  const rawPublicKey = new Uint8Array(rawPublicKeyBuffer);
  if (1) {
    const privateKeyJWK = await cryptoProxy_default.exportKey("jwk", ecdhKeys.privateKey);
    log("We begin the TLS connection by generating an [ECDH](https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman) key pair using curve [P-256](https://neuromancer.sk/std/nist/P-256). The private key, d, is simply a 256-bit integer picked at random:");
    log(...highlightColonList("d: " + hexFromU8(fromBase64(privateKeyJWK.d, { alphabet: "base64url" }))));
    log("The public key is a point on the curve. The point is [derived from d and a base point](https://curves.xargs.org). It\u2019s identified by coordinates x and y.");
    log(...highlightColonList("x: " + hexFromU8(fromBase64(privateKeyJWK.x, { alphabet: "base64url" }))));
    log(...highlightColonList("y: " + hexFromU8(fromBase64(privateKeyJWK.y, { alphabet: "base64url" }))));
  }
  log("Now we have a public/private key pair, we can start the TLS handshake by sending a client hello message ([source](https://github.com/jawj/subtls/blob/main/src/tls/makeClientHello.ts)). This includes the public key:");
  const sessionId = new Uint8Array(32);
  await getRandomValues(sessionId);
  const clientHello = await makeClientHello(host, rawPublicKey, sessionId, useSNI, protocolsForALPN);
  log(...highlightBytes(clientHello.commentedString(), "#8cc" /* client */));
  const clientHelloData = clientHello.array();
  const initialData = writePreData ? concat(writePreData, clientHelloData) : clientHelloData;
  networkWrite(initialData);
  log("The server returns a response, which includes its own public key, and we parse it ([source](https://github.com/jawj/subtls/blob/main/src/tls/parseServerHello.ts)):");
  if (expectPreData) {
    const receivedPreData = await networkRead(expectPreData.length);
    if (!receivedPreData || !equal(receivedPreData, expectPreData)) throw new Error("Pre data did not match expectation");
    log(...highlightBytes(hexFromU8(receivedPreData) + "  " + commentPreData, "#88c" /* server */));
  }
  const serverHello = bytesFromTlsRecords(networkRead, 22 /* Handshake */);
  const serverPublicKey = await parseServerHello(serverHello, sessionId);
  log(appendLog, ...highlightBytes(serverHello.commentedString(false), "#88c" /* server */));
  log("For the benefit of badly-written middleboxes that are following along expecting TLS 1.2, the server sends us a meaningless cipher change record:");
  const ccipher = bytesFromTlsRecords(networkRead, 20 /* ChangeCipherSpec */);
  await ccipher.expectUint8(1, "dummy ChangeCipherSpec payload (middlebox compatibility)");
  log(appendLog, ...highlightBytes(ccipher.commentedString(false), "#88c" /* server */));
  log("Both sides of the exchange now have everything they need to calculate the keys and IVs that will protect the rest of the handshake:");
  log("%c%s", `color: ${"#c88" /* header */}`, "handshake key computations ([source](https://github.com/jawj/subtls/blob/main/src/tls/keys.ts))");
  const clientHelloContent = clientHelloData.subarray(5);
  const serverHelloContent = serverHello.array();
  const hellos = concat(clientHelloContent, serverHelloContent);
  const handshakeKeys = await getHandshakeKeys(serverPublicKey, ecdhKeys.privateKey, hellos, 256, 16);
  const serverHandshakeKey = await cryptoProxy_default.importKey("raw", handshakeKeys.serverHandshakeKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const handshakeDecrypter = new Crypter("decrypt", serverHandshakeKey, handshakeKeys.serverHandshakeIV);
  const clientHandshakeKey = await cryptoProxy_default.importKey("raw", handshakeKeys.clientHandshakeKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const handshakeEncrypter = new Crypter("encrypt", clientHandshakeKey, handshakeKeys.clientHandshakeIV);
  log("The server continues by sending one or more encrypted records containing the rest of its handshake messages. These include the \u2018certificate verify\u2019 message, which we check on the spot, and the full certificate chain, which we verify a bit later on:");
  const handshakeBytes = bytesFromEncryptedTlsRecords(networkRead, handshakeDecrypter, 22 /* Handshake */);
  const { handshakeData: serverHandshake, clientCertRequested, userCert, protocolFromALPN } = await parseEncryptedHandshake(
    host,
    handshakeBytes,
    handshakeKeys.serverSecret,
    hellos,
    rootCertsDatabase,
    requireServerTlsExtKeyUsage,
    requireDigitalSigKeyUsage
  );
  log("For the benefit of badly-written middleboxes that are following along expecting TLS 1.2, it\u2019s the client\u2019s turn to send a meaningless cipher change record:");
  const clientCipherChange = new Bytes();
  clientCipherChange.writeUint8(20, "record type: ChangeCipherSpec");
  clientCipherChange.writeUint16(771, "TLS version 1.2 (middlebox compatibility)");
  const endClientCipherChangePayload = clientCipherChange.writeLengthUint16();
  clientCipherChange.writeUint8(1, "dummy ChangeCipherSpec payload (middlebox compatibility)");
  endClientCipherChangePayload();
  log(...highlightBytes(clientCipherChange.commentedString(), "#8cc" /* client */));
  const clientCipherChangeData = clientCipherChange.array();
  let clientCertRecordData = new Uint8Array(0);
  if (clientCertRequested) {
    const clientCertRecord = new Bytes();
    clientCertRecord.writeUint8(11, "handshake message type: client certificate");
    const endClientCerts = clientCertRecord.writeLengthUint24("client certificate data");
    clientCertRecord.writeUint8(0, "certificate context: none");
    clientCertRecord.writeUint24(0, "certificate list: empty");
    endClientCerts();
    clientCertRecordData = clientCertRecord.array();
    log("Since a client cert was requested, we\u2019re obliged to send a blank one. Here it is unencrypted:");
    log(...highlightBytes(clientCertRecord.commentedString(), "#8cc" /* client */));
  }
  log("Next, we send a \u2018handshake finished\u2019 message, which includes an HMAC of the handshake to date. This is how it looks before encryption:");
  const wholeHandshake = concat(hellos, serverHandshake, clientCertRecordData);
  const wholeHandshakeHashBuffer = await cryptoProxy_default.digest("SHA-256", wholeHandshake);
  const wholeHandshakeHash = new Uint8Array(wholeHandshakeHashBuffer);
  const finishedKey = await hkdfExpandLabel(handshakeKeys.clientSecret, "finished", new Uint8Array(0), 32, 256);
  const verifyHmacKey = await cryptoProxy_default.importKey("raw", finishedKey, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
  const verifyDataBuffer = await cryptoProxy_default.sign("HMAC", verifyHmacKey, wholeHandshakeHash);
  const verifyData = new Uint8Array(verifyDataBuffer);
  const clientFinishedRecord = new Bytes();
  clientFinishedRecord.writeUint8(20, "handshake message type: finished");
  const clientFinishedRecordEnd = clientFinishedRecord.writeLengthUint24("handshake finished data");
  clientFinishedRecord.writeBytes(verifyData);
  clientFinishedRecord.comment("verify data");
  clientFinishedRecordEnd();
  const clientFinishedRecordData = clientFinishedRecord.array();
  log(...highlightBytes(clientFinishedRecord.commentedString(), "#8cc" /* client */));
  log("And here\u2019s the client certificate (if requested) and handshake finished messages encrypted with the client\u2019s handshake key and ready to go:");
  const encryptedClientFinished = await makeEncryptedTlsRecords(concat(clientCertRecordData, clientFinishedRecordData), handshakeEncrypter, 22 /* Handshake */);
  let partialHandshakeHash = wholeHandshakeHash;
  if (clientCertRecordData.length > 0) {
    const partialHandshake = wholeHandshake.subarray(0, wholeHandshake.length - clientCertRecordData.length);
    const partialHandshakeHashBuffer = await cryptoProxy_default.digest("SHA-256", partialHandshake);
    partialHandshakeHash = new Uint8Array(partialHandshakeHashBuffer);
  }
  log("Both parties now have what they need to calculate the keys and IVs that will protect the application data:");
  log("%c%s", `color: ${"#c88" /* header */}`, "application key computations ([source](https://github.com/jawj/subtls/blob/main/src/tls/keys.ts))");
  const applicationKeys = await getApplicationKeys(handshakeKeys.handshakeSecret, partialHandshakeHash, 256, 16);
  const clientApplicationKey = await cryptoProxy_default.importKey("raw", applicationKeys.clientApplicationKey, { name: "AES-GCM" }, true, ["encrypt"]);
  const applicationEncrypter = new Crypter("encrypt", clientApplicationKey, applicationKeys.clientApplicationIV);
  const serverApplicationKey = await cryptoProxy_default.importKey("raw", applicationKeys.serverApplicationKey, { name: "AES-GCM" }, true, ["decrypt"]);
  const applicationDecrypter = new Crypter("decrypt", serverApplicationKey, applicationKeys.serverApplicationIV);
  let wroteFinishedRecords = false;
  log("The TLS connection is established, and server and client can start exchanging encrypted application data.");
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
    const allRecords = localWroteFinishedRecords ? concat(...encryptedRecords) : concat(clientCipherChangeData, ...encryptedClientFinished, ...encryptedRecords);
    networkWrite(allRecords);
  };
  const end = async () => {
    const [alertRecord] = await makeEncryptedTlsRecords(new Uint8Array([1, 0]), applicationEncrypter, 21 /* Alert */);
    networkWrite(alertRecord);
  };
  return { read, write, end, userCert, protocolFromALPN };
}

// src/util/parseURL.ts
function parseAsHTTP(url, parseQueryString = false) {
  const { protocol } = new URL(url);
  const httpUrl = "http:" + url.substring(protocol.length);
  const { username, password: rawPwd, hostname, port, pathname, search, searchParams, hash } = new URL(httpUrl);
  const password = decodeURIComponent(rawPwd);
  const auth = username + ":" + password;
  const query = parseQueryString ? Object.fromEntries(searchParams.entries()) : search;
  return { href: url, protocol, auth, username, password, hostname, port, pathname, search, query, hash };
}

// src/postgres.ts
var te3 = new TextEncoder();
async function postgres(urlStr, transportFactory, rootCertsPromise2, pipelinedPasswordAuth = false) {
  const t0 = Date.now();
  const url = parseAsHTTP(urlStr);
  const host = url.hostname;
  const port = url.port || "5432";
  const db = url.pathname.slice(1);
  const user = url.username;
  const password = pipelinedPasswordAuth ? `project=${host.match(/^[^.]+/)[0]};${url.password}` : url.password;
  let done = false;
  const transport = await transportFactory(host, port, {
    close: () => {
      if (!done) throw new Error("Unexpected connection close");
      log("Connection closed by remote peer (this message may show up out of order, before the last data has been decrypted and logged)");
    }
  });
  log("First of all, we send a fixed 8-byte sequence that asks the Postgres server if SSL/TLS is available:");
  const sslRequest = new Bytes();
  const endSslRequest = sslRequest.writeLengthUint32Incl("SSL request");
  sslRequest.writeUint32(80877103, "[SSLRequest](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SSLREQUEST) code");
  endSslRequest();
  log(...highlightBytes(sslRequest.commentedString(), "#8cc" /* client */));
  const writePreData = sslRequest.array();
  transport.write(writePreData);
  const SorN = await transport.read(1);
  log('The server tells us if it can speak SSL/TLS ("S" for SSL, "N" for No SSL):');
  const byte = new Bytes(SorN);
  await byte.expectUint8(83, '"S" = SSL connection supported');
  log(...highlightBytes(byte.commentedString(), "#88c" /* server */));
  const rootCerts = await rootCertsPromise2;
  const { read: readChunk, write, userCert } = await startTls(host, rootCerts, transport.read, transport.write, {
    useSNI: !pipelinedPasswordAuth,
    requireServerTlsExtKeyUsage: false,
    requireDigitalSigKeyUsage: false
  });
  const readQueue = new LazyReadFunctionReadQueue(readChunk);
  const read = readQueue.read.bind(readQueue);
  log("We continue by sending Postgres a [StartupMessage](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-STARTUPMESSAGE).");
  const msg = new Bytes();
  const endStartupMessage = msg.writeLengthUint32Incl("StartupMessage");
  msg.writeUint32(196608, "protocol version");
  msg.writeUTF8StringNullTerminated("user");
  msg.writeUTF8StringNullTerminated(user);
  msg.writeUTF8StringNullTerminated("database");
  msg.writeUTF8StringNullTerminated(db);
  msg.writeUTF8StringNullTerminated("application_name");
  msg.writeUTF8StringNullTerminated("bytebybyte.dev");
  msg.writeUint8(0, "end of message");
  endStartupMessage();
  if (pipelinedPasswordAuth) {
    msg.writeUTF8String("p");
    msg.comment("= [PasswordMessage](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PASSWORDMESSAGE)");
    const endPasswordMessage = msg.writeLengthUint32Incl("password message");
    msg.writeUTF8StringNullTerminated(password);
    endPasswordMessage();
    msg.writeUTF8String("Q");
    msg.comment("= [Query](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-QUERY)");
    const endQuery = msg.writeLengthUint32Incl("query");
    msg.writeUTF8StringNullTerminated("SELECT now()");
    endQuery();
    log("So: we now resume our Postgres communications. Because we know what authentication scheme the server will offer, we can save several network round-trips and bundle up a Postgres startup message, a cleartext password message, and a simple query. Here\u2019s the pipelined plaintext:");
  }
  log(...highlightBytes(msg.commentedString(), "#8cc" /* client */));
  log("And the ciphertext looks like this:");
  await write(msg.array());
  log("Postgres now responds with a request for authentication. Encrypted, as received:");
  const preAuthBytes = new Bytes(read);
  await preAuthBytes.expectUint8("R".charCodeAt(0), '"R" = authentication request');
  const [endAuthReq, authReqRemaining] = await preAuthBytes.expectLengthUint32Incl("request");
  const authMechanism = await preAuthBytes.readUint32();
  const saslMechanisms = /* @__PURE__ */ new Set();
  if (authMechanism === 3) {
    preAuthBytes.comment("request password auth ([AuthenticationCleartextPassword](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONCLEARTEXTPASSWORD))");
  } else if (authMechanism === 10) {
    preAuthBytes.comment("AuthenticationSASL message: request SASL auth");
    while (authReqRemaining() > 1) {
      const mechanism = await preAuthBytes.readUTF8StringNullTerminated();
      saslMechanisms.add(mechanism);
    }
    await preAuthBytes.expectUint8(0, "end of list");
    if (!saslMechanisms.has("SCRAM-SHA-256-PLUS")) throw new Error("This software only supports SCRAM-SHA-256-PLUS (with channel binding)");
  } else {
    throw new Error(`Unsupported auth mechanism: ${authMechanism}`);
  }
  endAuthReq();
  log("Decrypted and parsed:");
  log(...highlightBytes(preAuthBytes.commentedString(), "#88c" /* server */));
  if (authMechanism === 10) {
    log("So the server requires [SASL authentication](https://www.postgresql.org/docs/current/sasl-authentication.html), and the supported mechanisms are: %c" + [...saslMechanisms].join(", ") + "%c.", textColour, mutedColour);
    log("We continue by picking SCRAM-SHA-256-PLUS. This is defined in [RFC 5802](https://datatracker.ietf.org/doc/html/rfc5802) and provides channel binding (see [RFC 5056](https://datatracker.ietf.org/doc/html/rfc5056)) for some additional protection against MITM attacks.");
    log("That selection is the first part of the Postgres SASLInitialResponse we now send. The second part is a SCRAM client-first-message, which consists of three parameters: p, n and r.");
    log("p= selects the channel binding method: tls-server-end-point is the only one Postgres currently supports. A patch to also support tls-exporter ([RFC 9266](https://datatracker.ietf.org/doc/html/rfc9266)) [was discussed back in 2022](https://www.postgresql.org/message-id/YwxWWQR6uwWHBCbQ%40paquier.xyz), but ran into difficulties.");
    log("n= sets the username: we leave this empty, since [Postgres ignores this](https://www.postgresql.org/docs/current/sasl-authentication.html#SASL-SCRAM-SHA-256) in favour of the user specified in the StartupMessage above.");
    log("r= provides a 24-character random nonce, which we\u2019ll generate now.");
    const clientNonceData = new Uint8Array(18);
    await getRandomValues(clientNonceData);
    const clientNonceStr = toBase64(clientNonceData);
    log(...highlightColonList(`client nonce: ${clientNonceStr}`));
    log("(By the standard, the nonce can include any printable ASCII characters except comma. But, [following Postgres\u2019 lead](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/libpq/auth-scram.c#L1217), we sacrifice some entropy for the sake of convenience, generating 18 random bytes and base64-encoding them instead).");
    const saslInitResponse = new Bytes();
    saslInitResponse.writeUTF8String("p");
    saslInitResponse.comment("= SASLInitialResponse");
    const endSaslInitResponse = saslInitResponse.writeLengthUint32Incl("message");
    saslInitResponse.writeUTF8StringNullTerminated("SCRAM-SHA-256-PLUS");
    const gs2Header = "p=tls-server-end-point,,";
    const endInitialClientResponse = saslInitResponse.writeLengthUint32("client-first-message");
    saslInitResponse.writeUTF8String(gs2Header);
    saslInitResponse.comment("(there\u2019s an empty authzid field between these commas)");
    const clientFirstMessageBare = `n=,r=${clientNonceStr}`;
    saslInitResponse.writeUTF8String(clientFirstMessageBare);
    saslInitResponse.comment("(this part is called the client-first-message-bare)");
    endInitialClientResponse();
    endSaslInitResponse();
    log(...highlightBytes(saslInitResponse.commentedString(), "#8cc" /* client */));
    log("And as ciphertext:");
    await write(saslInitResponse.array());
    log("The server responds with an AuthenticationSASLContinue SASL challenge message. This carries the SCRAM server-first-message, made up of our random nonce extended by another 24 bytes (r), a salt (s), and an iteration count (i).");
    const serverSaslContinueBytes = new Bytes(read);
    await serverSaslContinueBytes.expectUint8("R".charCodeAt(0), '"R" = authentication request');
    const [endServerSaslContinue, serverSaslContinueRemaining] = await serverSaslContinueBytes.expectLengthUint32Incl();
    await serverSaslContinueBytes.expectUint32(11, "AuthenticationSASLContinue");
    const serverFirstMessage = await serverSaslContinueBytes.readUTF8String(serverSaslContinueRemaining());
    endServerSaslContinue();
    log(...highlightBytes(serverSaslContinueBytes.commentedString(), "#88c" /* server */));
    const attrs = Object.fromEntries(serverFirstMessage.split(",").map((v) => [v[0], v.slice(2)]));
    const { r: nonceStr, s: saltB64, i: iterationsStr } = attrs;
    const iterations = parseInt(iterationsStr, 10);
    log("%c%s", `color: ${"#c88" /* header */}`, "server-supplied SASL values");
    log(...highlightColonList(`nonce: ${nonceStr}`));
    log(...highlightColonList(`salt: ${saltB64}`));
    log(...highlightColonList(`number of iterations: ${iterations}`));
    if (!nonceStr.startsWith(clientNonceStr)) throw new Error("Server nonce does not extend client nonce we supplied");
    log("%c\u2713 nonce extends the client nonce we supplied", "color: #8c8;");
    log("The second and final client authentication message has several elements. First, some channel-binding data (c). Second, a reiteration of the full client + server nonce (r). Those two give us the client-final-message-without-proof. And third, a proof (p) that we know the user\u2019s password. That gives us the full client-final-message.");
    log(...highlightColonList(`The channel-binding data tells the server who we think we\u2019re talking to. We present a hash of the end-user certificate we received from the server during the TLS handshake above. That\u2019s the first certificate in the chain, which (as you can double-check above) is in this case: serial number ${hexFromU8(userCert.serialNumber)}, for ${userCert.subjectAltNames?.join(", ")}.`));
    log("This has a somewhat similar purpose to [certificate pinning](https://owasp.org/www-community/controls/Certificate_and_Public_Key_Pinning). It rules out some sophisticated MITM attacks in which we connect to a proxy that has a certificate that appears valid for the real server but is not the real server\u2019s.");
    let hashAlgo = algorithmWithOID(userCert.algorithm)?.hash?.name;
    if (hashAlgo === "SHA-1" || hashAlgo === "MD5") hashAlgo = "SHA-256";
    log(...highlightColonList(`The hash we present is determined by the certificate\u2019s algorithm (unless that\u2019s MD5 or SHA-1, in which case it\u2019s upgraded to SHA-256). For this particular certificate, it\u2019s: ${hashAlgo}.`));
    const hashedCert = new Uint8Array(await cryptoProxy_default.digest(hashAlgo, userCert.rawData));
    log(...highlightColonList(`certificate hash: ${hexFromU8(hashedCert)}`));
    const cbindMessageB64 = toBase64(concat(te3.encode(gs2Header), hashedCert));
    const clientFinalMessageWithoutProof = `c=${cbindMessageB64},r=${nonceStr}`;
    log(`The channel-binding data (c) consists of the channel-binding header we sent before (${gs2Header}), followed by this binary hash, all base64-encoded. That completes the client-final-message-without-proof.`);
    log(...highlightColonList(`client-final-message-without-proof: ${clientFinalMessageWithoutProof}`));
    const salt = fromBase64(saltB64);
    const passwordBytes = te3.encode(password);
    log("So: what about the proof? Well, there are a few steps to this.");
    log("One of SCRAM authentication\u2019s goals is to make it hard to brute-force a user\u2019s password even given access to their stored credentials. That\u2019s done by requiring time-consuming sequential calculations via [PBKDF2](https://en.wikipedia.org/wiki/PBKDF2).");
    log("So we now calculate a long chain of SHA-256 HMACs using the password and the salt, and XOR each result with the previous one. This is [operation Hi(str, salt, i) in RFC 5802](https://datatracker.ietf.org/doc/html/rfc5802#section-2.2).");
    const HiHmacKey = await cryptoProxy_default.importKey(
      "raw",
      passwordBytes,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );
    let Ui = new Uint8Array(await cryptoProxy_default.sign("HMAC", HiHmacKey, concat(salt, [0, 0, 0, 1])));
    let saltedPassword = Ui;
    log(...highlightColonList(`first result: ${hexFromU8(saltedPassword)}`));
    for (let i = 1; i < iterations; i++) {
      Ui = new Uint8Array(await cryptoProxy_default.sign("HMAC", HiHmacKey, Ui));
      saltedPassword = saltedPassword.map((x, j) => x ^ Ui[j]);
    }
    log(`... ${iterations - 2} intermediate results ...`);
    log(...highlightColonList(`final result \u2014 the SaltedPassword: ${hexFromU8(saltedPassword)}`));
    const ckHmacKey = await cryptoProxy_default.importKey(
      "raw",
      saltedPassword,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );
    const clientKey = new Uint8Array(await cryptoProxy_default.sign("HMAC", ckHmacKey, te3.encode("Client Key")));
    log('Next, we generate the ClientKey. It\u2019s an HMAC of the string "Client Key" using that SaltedPassword.');
    log(...highlightColonList(`ClientKey: ${hexFromU8(clientKey)}`));
    const storedKey = new Uint8Array(await cryptoProxy_default.digest("SHA-256", clientKey));
    log("The StoredKey is then the SHA-256 hash of the ClientKey.");
    log(...highlightColonList(`StoredKey: ${hexFromU8(storedKey)}`));
    log(`The StoredKey is one of the auth parameters stored by Postgres. In fact, you\u2019ll see the base64-encoded StoredKey ([alongside the salt, iteration count, and some other parameters](https://www.postgresql.org/docs/current/catalog-pg-authid.html)) if you run the following query against your database: SELECT rolpassword FROM pgauthid WHERE rolname='${user.replace(/'/g, "''")}'.`);
    log(...highlightColonList(`StoredKey, base64-encoded: ${toBase64(storedKey)}`));
    log("We now need to calculate the ClientSignature. This is an HMAC of the AuthMessage, which is itself a concatenation of the three previous messages sent between client and server.");
    const authMessage = `${clientFirstMessageBare},${serverFirstMessage},${clientFinalMessageWithoutProof}`;
    log(...highlightColonList(`AuthMessage: ${authMessage}`));
    const csHmacKey = await cryptoProxy_default.importKey(
      "raw",
      storedKey,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );
    const clientSignature = new Uint8Array(await cryptoProxy_default.sign("HMAC", csHmacKey, te3.encode(authMessage)));
    log(...highlightColonList(`ClientSignature: ${hexFromU8(clientSignature)}`));
    log("And at last we can calculate the proof (p), by XORing this ClientSignature with the ClientKey.");
    const clientProof = clientKey.map((x, i) => x ^ clientSignature[i]);
    log(...highlightColonList(`ClientProof: ${hexFromU8(clientProof)}`));
    log(...highlightColonList(`ClientProof, base64-encoded: ${toBase64(clientProof)}`));
    log("We\u2019re now ready to send the client-final-message as a Postgres SASLResponse:");
    const clientProofB64 = toBase64(clientProof);
    const clientFinalMessage = `${clientFinalMessageWithoutProof},p=${clientProofB64}`;
    const saslResponse = new Bytes();
    saslResponse.writeUTF8String("p");
    saslResponse.comment("= SASLResponse");
    const endSaslResponse = saslResponse.writeLengthUint32Incl("message");
    saslResponse.writeUTF8String(clientFinalMessage);
    saslResponse.comment("\u2014 the SCRAM client-final-message");
    endSaslResponse();
    log(...highlightBytes(saslResponse.commentedString(), "#8cc" /* client */));
    log("And as ciphertext:");
    await write(saslResponse.array());
    log("The server responds with a base64-encoded ServerSignature (v) \u2014 plus likely some further data that we\u2019ll parse below.");
    const authSaslFinalBytes = new Bytes(read);
    await authSaslFinalBytes.expectUint8("R".charCodeAt(0), '"R" = authentication request');
    const [endAuthSaslFinal, authSaslFinalRemaining] = await authSaslFinalBytes.expectLengthUint32Incl("message");
    await authSaslFinalBytes.expectUint32(12, "= AuthenticationSASLFinal");
    const saslOutcome = await authSaslFinalBytes.readUTF8String(authSaslFinalRemaining());
    authSaslFinalBytes.comment("\u2014 the base64-encoded ServerSignature");
    endAuthSaslFinal();
    log(...highlightBytes(authSaslFinalBytes.commentedString(), "#88c" /* server */));
    log('Now we calculate a server signature for ourselves, to see that it matches up \u2014 proving that the server has a record of our credentials. First we produce the ServerKey: an HMAC of the string "Server Key" using the SaltedPassword.');
    const skHmacKey = await cryptoProxy_default.importKey(
      "raw",
      saltedPassword,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );
    const serverKey = new Uint8Array(await cryptoProxy_default.sign("HMAC", skHmacKey, te3.encode("Server Key")));
    log(...highlightColonList(`ServerKey: ${hexFromU8(serverKey)}`));
    log("Then we make the ServerSignature, as an HMAC of the AuthMessage (as defined above) using the ServerKey.");
    const ssbHmacKey = await cryptoProxy_default.importKey(
      "raw",
      serverKey,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );
    const serverSignature = new Uint8Array(await cryptoProxy_default.sign("HMAC", ssbHmacKey, te3.encode(authMessage)));
    log(...highlightColonList(`ServerSignature: ${hexFromU8(serverSignature)}`));
    const serverSignatureB64 = toBase64(serverSignature);
    log(...highlightColonList(`ServerSignature, base64-encoded: ${serverSignatureB64}`));
    const remoteServerSignatureB64 = Object.fromEntries(saslOutcome.split(",").map((v) => [v[0], v.slice(2)])).v;
    if (remoteServerSignatureB64 !== serverSignatureB64) throw new Error("Server signature mismatch");
    log("%c\u2713 server signature matches locally-generated server signature", "color: #8c8;");
  }
  log("The server tells us we\u2019re in, and provides some other useful data.");
  const postAuthBytes = new Bytes(read);
  await postAuthBytes.expectUint8("R".charCodeAt(0), '"R" = authentication request');
  const [endAuthOK] = await postAuthBytes.expectLengthUint32Incl("authentication result");
  await postAuthBytes.expectUint32(0, "[AuthenticationOk](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONOK)");
  endAuthOK();
  while (true) {
    const msgType = await postAuthBytes.readUTF8String(1);
    if (msgType === "S") {
      postAuthBytes.comment("= [ParameterStatus](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARAMETERSTATUS)");
      const [endParams, paramsRemaining] = await postAuthBytes.expectLengthUint32Incl("run-time parameters");
      while (paramsRemaining() > 0) {
        const k = await postAuthBytes.readUTF8StringNullTerminated();
        const v = await postAuthBytes.readUTF8StringNullTerminated();
        void 0, v;
      }
      endParams();
    } else if (msgType === "K") {
      postAuthBytes.comment("= [BackendKeyData](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BACKENDKEYDATA)");
      const [endKeyData] = await postAuthBytes.expectLengthUint32Incl();
      await postAuthBytes.readUint32("backend process ID");
      await postAuthBytes.readUint32("backend secret key");
      endKeyData();
    } else if (msgType === "Z") {
      postAuthBytes.comment("= [ReadyForQuery](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-READYFORQUERY)");
      const [endStatus] = await postAuthBytes.expectLengthUint32Incl("status");
      await postAuthBytes.expectUint8("I".charCodeAt(0), '"I" = status: idle');
      endStatus();
      break;
    } else {
      throw new Error(`Unexpected message type: ${msgType} `);
    }
  }
  log("Decrypted and parsed:");
  log(...highlightBytes(postAuthBytes.commentedString(), "#88c" /* server */));
  if (pipelinedPasswordAuth === false) {
    const query = new Bytes();
    query.writeUTF8String("Q");
    msg.comment("= [Query](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-QUERY)");
    const endQuery = query.writeLengthUint32Incl("query");
    query.writeUTF8StringNullTerminated("SELECT now()");
    endQuery();
    log("The ReadyForQuery message indicates, of course, that we can now send our query message. It\u2019s pretty simple.");
    log(...highlightBytes(query.commentedString(), "#8cc" /* client */));
    log("Encrypted, that\u2019s:");
    await write(query.array());
  }
  log("Postgres returns our query result. Encrypted:");
  const queryResultBytes = new Bytes(read);
  await queryResultBytes.expectUint8("T".charCodeAt(0), '"T" = [RowDescription](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-ROWDESCRIPTION)');
  const [endRowDescription] = await queryResultBytes.expectLengthUint32Incl();
  const fieldsPerRow = await queryResultBytes.readUint16("fields per row");
  for (let i = 0; i < fieldsPerRow; i++) {
    const columnName = await queryResultBytes.readUTF8StringNullTerminated();
    queryResultBytes.comment("= column name", queryResultBytes.offset - 1);
    const tableOID = await queryResultBytes.readUint32("table OID");
    const colAttrNum = await queryResultBytes.readUint16("column attribute number");
    const dataTypeOID = await queryResultBytes.readUint32("data type OID");
    const dataTypeSize = await queryResultBytes.readUint16("data type size");
    const dataTypeModifier = await queryResultBytes.readUint32("data type modifier");
    const formatCode = await queryResultBytes.readUint16("format code");
    void 0, tableOID, colAttrNum, dataTypeOID, dataTypeSize, dataTypeModifier, formatCode;
  }
  endRowDescription();
  let lastColumnData;
  while (true) {
    const msgType = await queryResultBytes.readUTF8String(1);
    if (msgType === "D") {
      queryResultBytes.comment("= [DataRow](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-DATAROW)");
      const [endDataRow] = await queryResultBytes.expectLengthUint32Incl();
      const columnsToFollow = await queryResultBytes.readUint16("columns to follow");
      for (let i = 0; i < columnsToFollow; i++) {
        const [endColumn, columnRemaining] = await queryResultBytes.expectLengthUint32();
        lastColumnData = await queryResultBytes.readUTF8String(columnRemaining());
        queryResultBytes.comment("= column value");
        endColumn();
      }
      endDataRow();
    } else if (msgType === "C") {
      queryResultBytes.comment("= [Close](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-CLOSE)");
      const [endClose] = await queryResultBytes.expectLengthUint32Incl();
      await queryResultBytes.readUTF8StringNullTerminated();
      queryResultBytes.comment("= command tag", queryResultBytes.offset - 1);
      endClose();
    } else if (msgType === "Z") {
      queryResultBytes.comment("= [ReadyForQuery](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-READYFORQUERY)");
      const [endReady] = await queryResultBytes.expectLengthUint32Incl();
      await queryResultBytes.expectUint8("I".charCodeAt(0), '"I" = status: idle');
      endReady();
      break;
    } else {
      throw new Error(`Unexpected message type: ${msgType} `);
    }
  }
  log("Decrypted and parsed:");
  log(...highlightBytes(queryResultBytes.commentedString(), "#88c" /* server */));
  log("We pick out our result \u2014\xA0the current time on our server:");
  log("%c%s", "font-size: 2em; color: #000;", lastColumnData);
  const endBytes = new Bytes();
  endBytes.writeUTF8String("X");
  endBytes.comment("= [Terminate](https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-TERMINATE)");
  const endTerminate = endBytes.writeLengthUint32Incl();
  endTerminate();
  endBytes.comment("(and therefore end here too)");
  log("Job done. We send a termination command. Before encryption, that\u2019s:");
  log(...highlightBytes(endBytes.commentedString(), "#8cc" /* client */));
  log("And as sent on the wire:");
  await write(endBytes.array());
  done = true;
  log("The server should now send a TLS close-notify alert, then disconnect.");
  await readChunk();
  log(
    `Total bytes: %c${transport.stats.written}%c sent, %c${transport.stats.read}%c received`,
    textColour,
    mutedColour,
    textColour,
    mutedColour
  );
}

// src/h2.ts
var HTTP2FrameTypeNames = {
  0: "DATA",
  1: "HEADERS",
  2: "PRIORITY",
  3: "RST_STREAM",
  4: "SETTINGS",
  5: "PUSH_PROMISE",
  6: "PING",
  7: "GOAWAY",
  8: "WINDOW_UPDATE",
  9: "CONTINUATION"
};
var HTTP2SettingsTypeNames = {
  1: "SETTINGS_HEADER_TABLE_SIZE",
  2: "SETTINGS_ENABLE_PUSH",
  3: "SETTINGS_MAX_CONCURRENT_STREAMS",
  4: "SETTINGS_INITIAL_WINDOW_SIZE",
  5: "SETTINGS_MAX_FRAME_SIZE",
  6: "SETTINGS_MAX_HEADER_LIST_SIZE"
};
var HPACKStaticTable = [
  // https://datatracker.ietf.org/doc/html/rfc7541#appendix-A
  void 0,
  // no zero index
  [":authority"],
  [":method", "GET"],
  [":method", "POST"],
  [":path", "/"],
  [":path", "/index.html"],
  [":scheme", "http"],
  [":scheme", "https"],
  [":status", "200"],
  [":status", "204"],
  [":status", "206"],
  [":status", "304"],
  [":status", "400"],
  [":status", "404"],
  [":status", "500"],
  ["accept-charset"],
  ["accept-encoding", "gzip, deflate"],
  ["accept-language"],
  ["accept-ranges"],
  ["accept"],
  ["access-control-allow-origin"],
  ["age"],
  ["allow"],
  ["authorization"],
  ["cache-control"],
  ["content-disposition"],
  ["content-encoding"],
  ["content-language"],
  ["content-length"],
  ["content-location"],
  ["content-range"],
  ["content-type"],
  ["cookie"],
  ["date"],
  ["etag"],
  ["expect"],
  ["expires"],
  ["from"],
  ["host"],
  ["if-match"],
  ["if-modified-since"],
  ["if-none-match"],
  ["if-range"],
  ["if-unmodified-since"],
  ["last-modified"],
  ["link"],
  ["location"],
  ["max-forwards"],
  ["proxy-authenticate"],
  ["proxy-authorization"],
  ["range"],
  ["referer"],
  ["refresh"],
  ["retry-after"],
  ["server"],
  ["set-cookie"],
  ["strict-transport-security"],
  ["transfer-encoding"],
  ["user-agent"],
  ["vary"],
  ["via"],
  ["www-authenticate"]
];
function writeFrame(request, frameType, streamId, flags = 0, flagComments) {
  const payloadLengthOffset = request.offset;
  request.skipWrite(3);
  request.writeUint8(frameType, `frame type: ${HTTP2FrameTypeNames[frameType]}`);
  request.writeUint8(flags, `frame flags ${flagComments ?? ""}`);
  request.writeUint32(streamId, `stream ID: ${streamId}`);
  streamId === 0 && request.comment("= applies to the connection as a whole");
  request.changeIndent(1);
  const payloadStart = request.offset;
  return () => {
    const frameEnd = request.offset;
    const payloadLength = frameEnd - payloadStart;
    request.offset = payloadLengthOffset;
    request.writeUint24(payloadLength, `New HTTP/2 frame with payload length: ${payloadLength} bytes`);
    request.offset = frameEnd;
    request.changeIndent(-1);
  };
}
async function readFrame(response) {
  const payloadLength = await response.readUint24();
  response.comment(`New HTTP/2 frame with payload length: ${payloadLength} bytes`);
  const frameType = await response.readUint8();
  response.comment(`frame type: ${HTTP2FrameTypeNames[frameType]}`);
  const flags = await response.readUint8("frame flags");
  const streamId = await response.readUint32();
  response.comment(`stream ID: ${streamId}`);
  streamId === 0 && response.comment("= applies to the connection as a whole");
  response.changeIndent(1);
  const payloadStart = response.offset;
  const payloadEndIndex = payloadStart + payloadLength;
  const payloadEnd = () => {
    if (response.offset !== payloadEndIndex) throw new Error("Not at payload end");
    response.changeIndent(-1);
  };
  const payloadRemaining = () => payloadEndIndex - response.offset;
  return { payloadEnd, payloadRemaining, frameType, flags, streamId };
}

// src/util/hpackBytes.ts
var te4 = new TextEncoder();
var td3 = new TextDecoder();
var HuffmanCodes = [
  [8184, 13],
  [8388568, 23],
  [268435426, 28],
  [268435427, 28],
  [268435428, 28],
  [268435429, 28],
  [268435430, 28],
  [268435431, 28],
  [268435432, 28],
  [16777194, 24],
  [1073741820, 30],
  [268435433, 28],
  [268435434, 28],
  [1073741821, 30],
  [268435435, 28],
  [268435436, 28],
  [268435437, 28],
  [268435438, 28],
  [268435439, 28],
  [268435440, 28],
  [268435441, 28],
  [268435442, 28],
  [1073741822, 30],
  [268435443, 28],
  [268435444, 28],
  [268435445, 28],
  [268435446, 28],
  [268435447, 28],
  [268435448, 28],
  [268435449, 28],
  [268435450, 28],
  [268435451, 28],
  [20, 6],
  [1016, 10],
  // !
  [1017, 10],
  // "
  [4090, 12],
  // #
  [8185, 13],
  // $
  [21, 6],
  // %
  [248, 8],
  // &
  [2042, 11],
  // '
  [1018, 10],
  // (
  [1019, 10],
  // )
  [249, 8],
  // *
  [2043, 11],
  // +
  [250, 8],
  // ,
  [22, 6],
  // -
  [23, 6],
  // .
  [24, 6],
  // /
  [0, 5],
  // 0
  [1, 5],
  // 1
  [2, 5],
  // 2
  [25, 6],
  // 3
  [26, 6],
  // 4
  [27, 6],
  // 5
  [28, 6],
  // 6
  [29, 6],
  // 7
  [30, 6],
  // 8
  [31, 6],
  // 9
  [92, 7],
  // :
  [251, 8],
  // ;
  [32764, 15],
  // <
  [32, 6],
  // =
  [4091, 12],
  // >
  [1020, 10],
  // ?
  [8186, 13],
  // @
  [33, 6],
  // A
  [93, 7],
  // B
  [94, 7],
  // C
  [95, 7],
  // D
  [96, 7],
  // E
  [97, 7],
  // F
  [98, 7],
  // G
  [99, 7],
  // H
  [100, 7],
  // I
  [101, 7],
  // J
  [102, 7],
  // K
  [103, 7],
  // L
  [104, 7],
  // M
  [105, 7],
  // N
  [106, 7],
  // O
  [107, 7],
  // P
  [108, 7],
  // Q
  [109, 7],
  // R
  [110, 7],
  // S
  [111, 7],
  // T
  [112, 7],
  // U
  [113, 7],
  // V
  [114, 7],
  // W
  [252, 8],
  // X
  [115, 7],
  // Y
  [253, 8],
  // Z
  [8187, 13],
  // [
  [524272, 19],
  // \
  [8188, 13],
  // ]
  [16380, 14],
  // ^
  [34, 6],
  // _
  [32765, 15],
  // `
  [3, 5],
  // a
  [35, 6],
  // b
  [4, 5],
  // c
  [36, 6],
  // d
  [5, 5],
  // e
  [37, 6],
  // f
  [38, 6],
  // g
  [39, 6],
  // h
  [6, 5],
  // i
  [116, 7],
  // j
  [117, 7],
  // k
  [40, 6],
  // l
  [41, 6],
  // m
  [42, 6],
  // n
  [7, 5],
  // o
  [43, 6],
  // p
  [118, 7],
  // q
  [44, 6],
  // r
  [8, 5],
  // s
  [9, 5],
  // t
  [45, 6],
  // u
  [119, 7],
  // v
  [120, 7],
  // w
  [121, 7],
  // x
  [122, 7],
  // y
  [123, 7],
  // z
  [32766, 15],
  // {
  [2044, 11],
  // |
  [16381, 14],
  // }
  [8189, 13],
  // ~
  [268435452, 28],
  [1048550, 20],
  [4194258, 22],
  [1048551, 20],
  [1048552, 20],
  [4194259, 22],
  [4194260, 22],
  [4194261, 22],
  [8388569, 23],
  [4194262, 22],
  [8388570, 23],
  [8388571, 23],
  [8388572, 23],
  [8388573, 23],
  [8388574, 23],
  [16777195, 24],
  [8388575, 23],
  [16777196, 24],
  [16777197, 24],
  [4194263, 22],
  [8388576, 23],
  [16777198, 24],
  [8388577, 23],
  [8388578, 23],
  [8388579, 23],
  [8388580, 23],
  [2097116, 21],
  [4194264, 22],
  [8388581, 23],
  [4194265, 22],
  [8388582, 23],
  [8388583, 23],
  [16777199, 24],
  [4194266, 22],
  [2097117, 21],
  [1048553, 20],
  [4194267, 22],
  [4194268, 22],
  [8388584, 23],
  [8388585, 23],
  [2097118, 21],
  [8388586, 23],
  [4194269, 22],
  [4194270, 22],
  [16777200, 24],
  [2097119, 21],
  [4194271, 22],
  [8388587, 23],
  [8388588, 23],
  [2097120, 21],
  [2097121, 21],
  [4194272, 22],
  [2097122, 21],
  [8388589, 23],
  [4194273, 22],
  [8388590, 23],
  [8388591, 23],
  [1048554, 20],
  [4194274, 22],
  [4194275, 22],
  [4194276, 22],
  [8388592, 23],
  [4194277, 22],
  [4194278, 22],
  [8388593, 23],
  [67108832, 26],
  [67108833, 26],
  [1048555, 20],
  [524273, 19],
  [4194279, 22],
  [8388594, 23],
  [4194280, 22],
  [33554412, 25],
  [67108834, 26],
  [67108835, 26],
  [67108836, 26],
  [134217694, 27],
  [134217695, 27],
  [67108837, 26],
  [16777201, 24],
  [33554413, 25],
  [524274, 19],
  [2097123, 21],
  [67108838, 26],
  [134217696, 27],
  [134217697, 27],
  [67108839, 26],
  [134217698, 27],
  [16777202, 24],
  [2097124, 21],
  [2097125, 21],
  [67108840, 26],
  [67108841, 26],
  [268435453, 28],
  [134217699, 27],
  [134217700, 27],
  [134217701, 27],
  [1048556, 20],
  [16777203, 24],
  [1048557, 20],
  [2097126, 21],
  [4194281, 22],
  [2097127, 21],
  [2097128, 21],
  [8388595, 23],
  [4194282, 22],
  [4194283, 22],
  [33554414, 25],
  [33554415, 25],
  [16777204, 24],
  [16777205, 24],
  [67108842, 26],
  [8388596, 23],
  [67108843, 26],
  [134217702, 27],
  [67108844, 26],
  [67108845, 26],
  [134217703, 27],
  [134217704, 27],
  [134217705, 27],
  [134217706, 27],
  [134217707, 27],
  [268435454, 28],
  [134217708, 27],
  [134217709, 27],
  [134217710, 27],
  [134217711, 27],
  [134217712, 27],
  [67108846, 26],
  [1073741823, 30]
  // EOS
];
var HuffmanTree = [48, 49, 50, 97, 99, 101, 105, 111, 115, 116, [32, 37], [45, 46], [47, 51], [52, 53], [54, 55], [56, 57], [61, 65], [95, 98], [100, 102], [103, 104], [108, 109], [110, 112], [114, 117], [[58, 66], [67, 68]], [[69, 70], [71, 72]], [[73, 74], [75, 76]], [[77, 78], [79, 80]], [[81, 82], [83, 84]], [[85, 86], [87, 89]], [[106, 107], [113, 118]], [[119, 120], [121, 122]], [[[38, 42], [44, 59]], [[88, 90], [[[33, 34], [40, 41]], [[63, [39, 43]], [[124, [35, 62]], [[[0, 36], [64, 91]], [[93, 126], [[94, 125], [[60, 96], [123, [[[[92, 195], [208, [128, 130]]], [[[131, 162], [184, 194]], [[224, 226], [[153, 161], [167, 172]]]]], [[[[[176, 177], [179, 209]], [[216, 217], [227, 229]]], [[[230, [129, 132]], [[133, 134], [136, 146]]], [[[154, 156], [160, 163]], [[164, 169], [170, 173]]]]], [[[[[178, 181], [185, 186]], [[187, 189], [190, 196]]], [[[198, 228], [232, 233]], [[[1, 135], [137, 138]], [[139, 140], [141, 143]]]]], [[[[[147, 149], [150, 151]], [[152, 155], [157, 158]]], [[[165, 166], [168, 174]], [[175, 180], [182, 183]]]], [[[[188, 191], [197, 231]], [[239, [9, 142]], [[144, 145], [148, 159]]]], [[[[171, 206], [215, 225]], [[236, 237], [[199, 207], [234, 235]]]], [[[[[192, 193], [200, 201]], [[202, 205], [210, 213]]], [[[218, 219], [238, 240]], [[242, 243], [255, [203, 204]]]]], [[[[[211, 212], [214, 221]], [[222, 223], [241, 244]]], [[[245, 246], [247, 248]], [[250, 251], [252, 253]]]], [[[[254, [2, 3]], [[4, 5], [6, 7]]], [[[8, 11], [12, 14]], [[15, 16], [17, 18]]]], [[[[19, 20], [21, 23]], [[24, 25], [26, 27]]], [[[28, 29], [30, 31]], [[127, 220], [249, [[10, 13], [22]]]]]]]]]]]]]]]]]]]]]]]]]];
var HPACKBytes = class extends Bytes {
  writeHPACKInt(i, leftBitCount = 0, leftBitValue = 0, suppressComment = false) {
    if (leftBitCount > 7) throw new Error("leftBitCount must be 7 or less");
    const iOriginal = i;
    const prefixBitCount = 8 - leftBitCount;
    const continuationValue = (1 << prefixBitCount) - 1;
    if (i < continuationValue) {
      this.writeUint8(leftBitValue << prefixBitCount | i);
    } else {
      this.writeUint8(leftBitValue << prefixBitCount | continuationValue);
      i -= continuationValue;
      while (i >= 128) {
        this.writeUint8(i & 127 | 128);
        i = i >> 7;
      }
      this.writeUint8(i);
    }
    !suppressComment && this.comment(`flag bit${leftBitCount === 1 ? "" : "s"} (${leftBitValue.toString(2).padStart(leftBitCount, "0")}), integer (${iOriginal})`);
  }
  async readHPACKInt(leftBitCount = 0, suppressComment = false) {
    const firstByte = await this.readUint8();
    const prefixBitCount = 8 - leftBitCount;
    const leftBitValue = firstByte >>> prefixBitCount;
    const continuationValue = (1 << prefixBitCount) - 1;
    let i = firstByte & continuationValue;
    if (i === continuationValue) {
      let byte, leftShift = 0;
      do {
        byte = await this.readUint8();
        i += (byte & 127) << leftShift;
        leftShift += 7;
      } while (byte & 128);
    }
    !suppressComment && this.comment(`flag bit${leftBitCount === 1 ? "" : "s"} (${leftBitValue.toString(2).padStart(leftBitCount, "0")}), integer (${i})`);
    return { leftBitValue, i };
  }
  writeHPACKString(s) {
    const inBytes = te4.encode(s);
    const inBytesLength = inBytes.byteLength;
    const outBytes = new Uint8Array(inBytesLength);
    let outByte = 0, outByteIndex = 0, outBitIndex = 0;
    let bitComment = "";
    huffman: {
      for (let i = 0; i < inBytesLength; i++) {
        const ch = inBytes[i];
        let [encodedValue, remainingBitCount] = HuffmanCodes[ch];
        if (1) bitComment += ` ${encodedValue.toString(2)}=` + (ch >= 33 && ch <= 126 ? String.fromCharCode(ch) : `0x${ch.toString(16).padStart(2, " ")}`);
        while (remainingBitCount > 0) {
          if (outBitIndex === 8) {
            outBytes[outByteIndex++] = outByte;
            if (outByteIndex === inBytesLength) break huffman;
            outByte = outBitIndex = 0;
          }
          const bitsLeftInByte = 8 - outBitIndex;
          const bitsToWrite = Math.min(bitsLeftInByte, remainingBitCount);
          const rightShiftBits = remainingBitCount - bitsLeftInByte;
          outByte = outByte | (rightShiftBits >= 0 ? encodedValue >>> rightShiftBits : encodedValue << -rightShiftBits);
          remainingBitCount -= bitsToWrite;
          encodedValue = encodedValue & (1 << remainingBitCount) - 1;
          outBitIndex += bitsToWrite;
        }
      }
      if (outBitIndex > 0) {
        const bitsLeftInByte = 8 - outBitIndex;
        const padding = (1 << bitsLeftInByte) - 1;
        outByte = outByte | padding;
        outBytes[outByteIndex++] = outByte;
        bitComment += ` ${padding.toString(2)}=(padding)`;
      }
    }
    if (outByteIndex < inBytesLength) {
      this.writeHPACKInt(outByteIndex, 1, 1);
      this.comment(`= [Huffman-encoded string](https://datatracker.ietf.org/doc/html/rfc7541#appendix-B), ${outByteIndex} bytes`);
      this.changeIndent(1);
      this.writeBytes(outBytes.subarray(0, outByteIndex));
      this.comment(`"${s}":${bitComment}`);
      this.changeIndent(-1);
    } else {
      this.writeHPACKInt(inBytesLength, 1, 0);
      this.comment(`= raw octet string, ${inBytesLength} bytes`);
      this.changeIndent(1);
      this.writeBytes(inBytes);
      this.comment(`"${s}"`);
      this.changeIndent(-1);
    }
  }
  async readHPACKString() {
    const { leftBitValue: huffman, i: length } = await this.readHPACKInt(1);
    this.comment(`= ${huffman ? "Huffman-encoded string" : "raw octet string"}, ${length} bytes`);
    this.changeIndent(1);
    if (!huffman) {
      const str2 = await this.readUTF8String(length);
      this.changeIndent(-1);
      return str2;
    }
    const inBytes = await this.readBytes(length);
    const outBytes = new Uint8Array(length << 1);
    let inByteIndex = 0, inBitIndex = 0, outByteIndex = 0, inByte;
    let node, branch;
    outer: while (true) {
      node = HuffmanTree;
      inByte = inBytes[inByteIndex];
      let inWord = inByte << 8;
      if (inBitIndex > 3) inWord |= inBytes[inByteIndex + 1];
      const rightShift = 11 - inBitIndex;
      branch = inWord >>> rightShift & 31;
      inBitIndex += 5;
      if (inBitIndex > 7) {
        inBitIndex -= 8;
        inByteIndex++;
        if (inByteIndex === length) break outer;
        inByte = inBytes[inByteIndex];
      }
      while (true) {
        node = node[branch];
        if (typeof node === "number") {
          outBytes[outByteIndex++] = node;
          break;
        }
        ;
        branch = inByte >> 7 - inBitIndex & 1;
        inBitIndex++;
        if (inBitIndex > 7) {
          inBitIndex -= 8;
          inByteIndex++;
          if (inByteIndex === length) break outer;
          inByte = inBytes[inByteIndex];
        }
      }
      ;
    }
    const str = td3.decode(outBytes.subarray(0, outByteIndex));
    this.comment(`"${str}"`);
    this.changeIndent(-1);
    return str;
  }
};

// src/https.ts
var txtDec2 = new TextDecoder();
async function https(urlStr, method, transportFactory, rootCertsPromise2, {
  headers = {},
  protocols = ["h2", "http/1.1"],
  socketOptions = {}
} = {}) {
  const url = new URL(urlStr);
  if (url.protocol !== "https:") throw new Error("Wrong protocol");
  const host = url.hostname;
  const port = url.port || 443;
  const reqPath = url.pathname + url.search;
  const transport = await transportFactory(host, port, {
    close: () => {
      log("Connection closed by remote peer (this message may show up out of order, before the last data has been decrypted and logged)");
    },
    ...socketOptions
  });
  const rootCerts = await rootCertsPromise2;
  const { read, write, end, protocolFromALPN } = await startTls(host, rootCerts, transport.read, transport.write, { protocolsForALPN: protocols });
  let response = "";
  if (protocolFromALPN === "h2") {
    log("It\u2019s time for an HTTP/2 GET request. This starts with a fixed 24-byte preface ([RFC 9113 \xA7 3.4](https://datatracker.ietf.org/doc/html/rfc9113#name-http-2-connection-preface)) that\u2019s specifically designed to make HTTP/1.1 servers throw in the towel, plus a mandatory [SETTINGS frame](https://datatracker.ietf.org/doc/html/rfc9113#section-6.5).");
    log("Then we get on with sending a [HEADERS frame](https://datatracker.ietf.org/doc/html/rfc9113#name-headers), including [pseudo-headers](https://datatracker.ietf.org/doc/html/rfc9113#PseudoHeaderFields) \u2014 :scheme, :method, :path and :authority \u2014 that specify the request. We don\u2019t wait to hear about the server\u2019s settings first, because we can be pretty sure it will accept our small request over a single stream.");
    log("These HTTP/2 headers are compressed using HPACK, a compression scheme that involves indexed tables, Huffman encoding, and various kinds of bit-twiddling. It\u2019s complex enough to get its own RFC, [RFC 7542](https://datatracker.ietf.org/doc/html/rfc7541).");
    const request = new HPACKBytes();
    request.writeUTF8String("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
    request.comment("\u2014 the connection preface");
    const endSettingsFrame = writeFrame(request, 4 /* SETTINGS */, 0);
    request.writeUint16(2, "setting: SETTINGS_ENABLE_PUSH");
    request.writeUint32(0, "value: disabled (we just want to fetch this page, thanks)");
    endSettingsFrame();
    const endHeadersFrame = writeFrame(request, 1 /* HEADERS */, 1, 4 | 1, "= END_HEADERS (0x04) | END_STREAM (0x01)");
    request.writeHPACKInt(7, 1, 1);
    request.comment('= [indexed field](https://datatracker.ietf.org/doc/html/rfc7541#section-6.1), ":scheme: https"');
    request.writeHPACKInt(2, 1, 1);
    request.comment('= indexed field, ":method: GET"');
    if (reqPath === "/") {
      request.writeHPACKInt(4, 1, 1);
      request.comment('= indexed field, ":path: /"');
    } else {
      request.writeHPACKInt(4, 4, 0);
      request.comment('= indexed field name / [field not added to index](https://datatracker.ietf.org/doc/html/rfc7541#section-6.2.2), ":path:"');
      request.writeHPACKString(reqPath);
    }
    request.writeHPACKInt(1, 2, 1);
    request.comment('= indexed field name / [field added to index](https://datatracker.ietf.org/doc/html/rfc7541#section-6.2.1), ":authority:"');
    request.writeHPACKString(host);
    endHeadersFrame();
    log(...highlightBytes(request.commentedString(), "#8cc" /* client */));
    log("Which goes to the server encrypted like so:");
    await write(request.array());
    log("The server replies:");
    const readQueue = new LazyReadFunctionReadQueue(read);
    const readFn = readQueue.read.bind(readQueue);
    const body = new GrowableData();
    let flagEndStream = false;
    while (!flagEndStream) {
      const response2 = new HPACKBytes(readFn);
      const { payloadEnd, payloadRemaining, frameType, flags, streamId } = await readFrame(response2);
      let ackFrame;
      switch (frameType) {
        case 4 /* SETTINGS */: {
          if (streamId !== 0) throw new Error("Illegal SETTINGS with non-zero stream ID");
          const ack = Boolean(flags & 1);
          if (ack) {
            log("And the server acknowledges our earlier SETTINGS frame:");
            response2.comment("= ACK client settings", response2.offset - 4);
            if (payloadRemaining() > 0) throw new Error("Illegal non-zero-length SETTINGS ACK");
            break;
          }
          if (payloadRemaining() % 6 !== 0) throw new Error("Illegal SETTINGS payload length");
          while (payloadRemaining() > 0) {
            const settingsType = await response2.readUint16();
            response2.comment(`setting: ${HTTP2SettingsTypeNames[settingsType] ?? "unrecognised ([GREASE](https://datatracker.ietf.org/doc/html/draft-bishop-httpbis-grease-01)?)"}`);
            const settingsValue = await response2.readUint32();
            response2.comment(`value: ${settingsValue}`);
          }
          log("This is the required initial SETTINGS frame from the server, which we immediately acknowledge:");
          ackFrame = new HPACKBytes();
          writeFrame(ackFrame, 4 /* SETTINGS */, 0, 1, "= ACK server settings");
          break;
        }
        case 8 /* WINDOW_UPDATE */: {
          log("Now we get a [WINDOW_UPDATE frame](https://datatracker.ietf.org/doc/html/rfc9113#name-window_update):");
          const winSizeInc = await response2.readUint32();
          response2.comment(`window size increment: ${winSizeInc} bytes`);
          break;
        }
        case 1 /* HEADERS */:
        case 9 /* CONTINUATION */:
        case 0 /* DATA */: {
          const flagPriority = Boolean(flags & 50);
          const flagPadded = Boolean(flags & 8);
          const flagEndHeaders = Boolean(flags & 4);
          flagEndStream = Boolean(flags & 1);
          if (1) {
            const flagNames = [];
            if (flagPriority) flagNames.push("PRIORITY");
            if (flagPadded) flagNames.push("PADDED");
            if (flagEndHeaders) flagNames.push("END_HEADERS");
            if (flagEndStream) flagNames.push("END_STREAM");
            response2.comment(`= ${flagNames.join(" | ")}`, response2.offset - 4);
          }
          let paddingBytes = 0;
          if (flagPadded) {
            paddingBytes = await response2.readUint8("padding length");
          }
          if (flagPriority) {
            await response2.readUint32("exclusive, stream dependency");
            await response2.readUint8("weight");
          }
          if (frameType === 1 /* HEADERS */ || frameType === 9 /* CONTINUATION */) {
            log("The server sends us its response HEADERS:");
            while (payloadRemaining() > paddingBytes) {
              const byte = await response2.readUint8();
              response2.offset--;
              if (byte & 128) {
                const { i: tableIndex } = await response2.readHPACKInt(1);
                if (tableIndex === 0) throw new Error("Illegal zero index for header");
                const [kStatic, vStatic] = HPACKStaticTable[tableIndex];
                response2.comment(`= indexed field, "${kStatic}: ${vStatic}"`);
              } else {
                const indexed = byte & 64;
                const { i: tableIndex, leftBitValue } = await response2.readHPACKInt(indexed ? 2 : 4);
                let k;
                if (tableIndex === 0) {
                  response2.comment(`= literal field / ${indexed ? "" : leftBitValue === 1 ? "never " : "not "}added to index`);
                  k = await response2.readHPACKString();
                } else {
                  k = HPACKStaticTable[tableIndex][0];
                  response2.comment(`= indexed field name / field ${indexed ? "" : leftBitValue === 1 ? "never " : "not "}added to index, "${k}:"`);
                }
                await response2.readHPACKString();
              }
            }
          } else {
            log("And finally we receive the response body as one or more [DATA frames](https://datatracker.ietf.org/doc/html/rfc9113#name-data). You\u2019ll see it first encrypted, then as a parsed HTTP/2 frame, and finally decoded as UTF-8 text.");
            body.append(await response2.readBytes(payloadRemaining() - paddingBytes));
            response2.comment("data");
          }
          if (paddingBytes > 0) await response2.skipRead(paddingBytes, "padding (should be zeroes)");
          break;
        }
        default: {
          await response2.readBytes(payloadRemaining());
          response2.comment("payload for unhandled frame type");
        }
      }
      payloadEnd();
      log(...highlightBytes(response2.commentedString(), "#88c" /* server */));
      if (frameType === 0 /* DATA */) log(txtDec2.decode(body.getData()));
      if (ackFrame) {
        log(...highlightBytes(ackFrame.commentedString(), "#8cc" /* client */));
        await write(ackFrame.array());
      }
    }
    log("Job done! At this point, we could send the server an HTTP/2 [GOAWAY frame](https://datatracker.ietf.org/doc/html/rfc9113#name-goaway), but most servers seem not to do anything in response. We could also just unceremoniously close the underlying WebSocket/TCP connection.");
    log("What we actually do is something in-between: we send a TLS close-notify Alert record, which will generally cause the server to hang up. Unencrypted, that\u2019s three bytes: 0x01 (Alert type: warning), 0x00 (warning type: close notify), 0x15 (TLS record type: Alert).");
    await end();
  } else {
    headers["Host"] ?? (headers["Host"] = host);
    log("Here\u2019s a GET request:");
    const request = new Bytes();
    request.writeUTF8String(`${method} ${reqPath} HTTP/1.0\r
`);
    for (const header in headers) request.writeUTF8String(`${header}: ${headers[header]}\r
`);
    request.writeUTF8String("\r\n");
    log(...highlightBytes(request.commentedString(), "#8cc" /* client */));
    log("Which goes to the server encrypted like so:");
    await write(request.array());
    log("The server replies:");
    let responseData;
    do {
      responseData = await read();
      if (responseData) {
        const responseText = txtDec2.decode(responseData);
        response += responseText;
        log(responseText);
      }
    } while (responseData);
  }
  log(
    `Total bytes: %c${transport.stats.written}%c sent, %c${transport.stats.read}%c received`,
    textColour,
    mutedColour,
    textColour,
    mutedColour
  );
  return response;
}

// src/util/wsTransport.ts
async function wsTransport(host, port, opts) {
  const ws = await new Promise((resolve) => {
    const wsURL = location.hostname === "localhost" ? "ws://localhost:6544" : "wss://subtls-wsproxy.jawj.workers.dev";
    const ws2 = new WebSocket(`${wsURL}/?address=${host}:${port}`);
    ws2.binaryType = "arraybuffer";
    ws2.addEventListener("open", () => resolve(ws2));
    ws2.addEventListener("error", (err) => {
      console.log("ws error:", err);
    });
    if (opts.close) ws2.addEventListener("close", opts.close);
  });
  const reader = new WebSocketReadQueue(ws);
  const stats = { read: 0, written: 0 };
  const read = async (bytes, readMode) => {
    const data = await reader.read(bytes, readMode);
    stats.read += data?.byteLength ?? 0;
    return data;
  };
  const write = (data) => {
    stats.written += data.byteLength ?? data.size ?? data.length;
    return ws.send(data);
  };
  const end = (code, reason) => ws.close(code, reason);
  return { read, write, end, stats };
}

// src/util/rootCerts.ts
var txtDec3 = new TextDecoder();
async function getFile(name) {
  try {
    const response = await fetch(name);
    const buf = await response.arrayBuffer();
    return buf;
  } catch {
    const fs = await import("fs/promises");
    const buf = await fs.readFile(`docs/${name}`);
    return buf.buffer;
  }
}
async function getRootCertsIndex() {
  const file = await getFile("certs.index.json");
  const rootCertsIndex = JSON.parse(txtDec3.decode(file));
  return rootCertsIndex;
}
async function getRootCertsData() {
  const file = await getFile("certs.binary.txt");
  const rootCertsData = new Uint8Array(file);
  return rootCertsData;
}
async function getRootCertsDatabase() {
  const [index, data] = await Promise.all([getRootCertsIndex(), getRootCertsData()]);
  return { index, data };
}

// src/index.ts
var rootCertsPromise = getRootCertsDatabase();
var qs = (sel) => document.querySelector(sel);
var pgTab = qs("#postgres");
var httpsTab = qs("#https");
var h2Para = qs("#http2");
var h2Chk = qs("#http2 input");
var goBtn = qs("#go");
var heading = qs("#heading");
var desc = qs("#description");
var logs = qs("#logs");
var pg = /[?]postgres(ql)?/i.test(location.search);
(pg ? pgTab : httpsTab).classList.add("active");
(pg ? httpsTab : pgTab).classList.remove("active");
if (pg) {
  goBtn.value = "Ask Postgres the time, byte by byte";
  heading.innerHTML = "See this page query Postgres, byte by byte, over TLS";
  desc.innerHTML = 'This page connects to a <a href="https://neon.tech">Neon</a> PostgreSQL instance over TLS with <a href="https://www.postgresql.org/docs/current/sasl-authentication.html#SASL-SCRAM-SHA-256">channel binding</a>. Then it runs this query: <span class="q">SELECT now()</span>.';
  h2Para.style.display = "none";
}
var logAndRethrow = (e) => {
  log(`%cError: ${e.message}%c`, `color: ${"#c88" /* header */}`, textColour);
  throw e;
};
goBtn.addEventListener("click", () => {
  logs.replaceChildren();
  let urlStr = location.hash.slice(1);
  if (pg) {
    if (!urlStr.startsWith("postgres")) urlStr = "postgresql://frodo:correct-horse-battery-staple@ep-crimson-sound-a8nnh11s-pooler.eastus2.azure.neon.tech/neondb";
    postgres(urlStr, wsTransport, rootCertsPromise, false).catch(logAndRethrow);
  } else {
    if (!urlStr.startsWith("https")) urlStr = "https://bytebybyte.dev";
    const protocols = ["http/1.1"];
    if (h2Chk.checked) protocols.unshift("h2");
    https(urlStr, "GET", wsTransport, rootCertsPromise, { protocols }).catch(logAndRethrow);
  }
});
