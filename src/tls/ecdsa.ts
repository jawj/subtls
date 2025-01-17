import { log } from '../presentation/log';
import { concat } from '../util/array';
import { ASN1Bytes } from '../util/asn1bytes';
import { universalTypeInteger } from './certUtils';
import cs from '../util/cryptoProxy';

export async function ecdsaVerify(sb: ASN1Bytes /* signature */, publicKey: Uint8Array, signedData: Uint8Array, namedCurve: 'P-256' | 'P-384', hash: 'SHA-256' | 'SHA-384') {
  const [endSigDer] = await sb.expectASN1Sequence();

  await sb.expectUint8(universalTypeInteger, chatty && 'integer');
  const [endSigRBytes, sigRBytesRemaining] = await sb.expectASN1Length(chatty && 'integer');
  const sigR = await sb.readBytes(sigRBytesRemaining());
  chatty && sb.comment('signature: r');
  endSigRBytes();

  await sb.expectUint8(universalTypeInteger, chatty && 'integer');
  const [endSigSBytes, sigSBytesRemaining] = await sb.expectASN1Length(chatty && 'integer');
  const sigS = await sb.readBytes(sigSBytesRemaining());
  chatty && sb.comment('signature: s');
  endSigSBytes();

  endSigDer();

  /*
  WebCrypto expects a 64- or 96-byte P1363 signature, which sometimes discards a leading zero on r and s that's added to indicate positive sign
  - https://crypto.stackexchange.com/questions/57731/ecdsa-signature-rs-to-asn1-der-encoding-question
  - https://crypto.stackexchange.com/questions/1795/how-can-i-convert-a-der-ecdsa-signature-to-asn-1/1797#1797
  - https://stackoverflow.com/a/65403229
  */

  const clampToLength = (x: Uint8Array, clampLength: number) =>
    x.length > clampLength ? x.subarray(x.length - clampLength) :  // too long? cut off leftmost bytes (msb)
      x.length < clampLength ? concat(new Uint8Array(clampLength - x.length), x) : // too short? left pad with zeroes
        x;  // right length: pass through

  const intLength = namedCurve === 'P-256' ? 32 : 48;
  const signature = concat(clampToLength(sigR, intLength), clampToLength(sigS, intLength));

  const signatureKey = await cs.importKey('spki', publicKey, { name: 'ECDSA', namedCurve }, false, ['verify']);
  const certVerifyResult = await cs.verify({ name: 'ECDSA', hash }, signatureKey, signature, signedData);

  if (certVerifyResult !== true) throw new Error('ECDSA certificate verify failed');
  chatty && log(`%c✓ ECDSA signature verified (curve ${namedCurve}, hash ${hash})`, 'color: #8c8;');
}