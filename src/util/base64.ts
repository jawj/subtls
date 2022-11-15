
function charCodeMap(charCode: number) {  // https://developer.mozilla.org/en-US/docs/Glossary/Base64
  /*
  ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789  +  /  =';
  65                      90 97                     122 48      57 43 47 61 
   0                      25 26                      51 52      61 62 63 64
  */
  return charCode > 64 && charCode < 91 ? charCode - 65 :
    charCode > 96 && charCode < 123 ? charCode - 71 :
      charCode > 47 && charCode < 58 ? charCode + 4 :
        charCode === 43 ? 62 :
          charCode === 47 ? 63 :
            charCode === 61 ? 64 :
              undefined;
}

export function base64Decode(input: string) {
  const len = input.length;
  let inputIdx = 0, outputIdx = 0;
  let enc1 = 64, enc2 = 64, enc3 = 64, enc4 = 64;
  const output = new Uint8Array(len * .75);

  while (inputIdx < len) {
    enc1 = charCodeMap(input.charCodeAt(inputIdx++))!;
    enc2 = charCodeMap(input.charCodeAt(inputIdx++))!;
    enc3 = charCodeMap(input.charCodeAt(inputIdx++))!;
    enc4 = charCodeMap(input.charCodeAt(inputIdx++))!;
    output[outputIdx++] = (enc1 << 2) | (enc2 >> 4);
    output[outputIdx++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    output[outputIdx++] = ((enc3 & 3) << 6) | enc4;
  }

  const excessLength =
    enc2 === 64 ? 0 :  // implies zero-length input
      enc3 === 64 ? 2 :
        enc4 === 64 ? 1 :
          0;

  return output.subarray(0, outputIdx - excessLength);
}