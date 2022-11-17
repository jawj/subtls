import * as pkijs from 'pkijs';

import { base64Decode } from '../util/base64';
import { hexFromU8 } from '../util/hex';
import Bytes from '../util/bytes';

import highlightCommented from '../presentation/highlightCommented';
import { LogColours } from '../presentation/appearance';
import { log } from '../presentation/log';

// @ts-ignore
import isrgrootx1 from '../roots/isrg-root-x1.pem';
// @ts-ignore
import isrgrootx2 from '../roots/isrg-root-x2.pem';
// @ts-ignore
import trustidx3root from '../roots/trustid-x3-root.pem';
// @ts-ignore
import cloudflare from '../roots/cloudflare.pem';


const universalTypeInteger = 0x02;
const constructedUniversalTypeSequence = 0x30;
const constructedUniversalTypeSet = 0x31;
const universalTypeOID = 0x06;
const universalTypePrintableString = 0x13;
const universalTypeUTF8String = 0x0c;
const universalTypeUTCTime = 0x17;
const universalTypeNull = 0x05;

const rdnmap: Record<string, string> = {
  "2.5.4.6": "C",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.3": "CN",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.12": "T",
  "2.5.4.42": "GN",
  "2.5.4.43": "I",
  "2.5.4.4": "SN",
  "1.2.840.113549.1.9.1": "E-mail"
};

const algomap: Record<string, string> = {
  "1.2.840.10040.4.3": "SHA1 with DSA",
  "1.2.840.10045.4.1": "SHA1 with ECDSA",
  "1.2.840.10045.4.3.2": "SHA256 with ECDSA",
  "1.2.840.10045.4.3.3": "SHA384 with ECDSA",
  "1.2.840.10045.4.3.4": "SHA512 with ECDSA",
  "1.2.840.113549.1.1.10": "RSA-PSS",
  "1.2.840.113549.1.1.5": "SHA1 with RSA",
  "1.2.840.113549.1.1.14": "SHA224 with RSA",
  "1.2.840.113549.1.1.11": "SHA256 with RSA",
  "1.2.840.113549.1.1.12": "SHA384 with RSA",
  "1.2.840.113549.1.1.13": "SHA512 with RSA"
};

function readASN1Length(bytes: Bytes) {
  const byte1 = bytes.readUint8();
  if (byte1 < 0x80) {
    bytes.comment(`${byte1} bytes follow (ASN.1)`);
    return byte1;  // highest bit unset: simple one-byte value
  }
  const lengthBytes = byte1 & 0x7f;
  if (lengthBytes === 1) return bytes.readUint8('% bytes follow (ASN.1)');
  if (lengthBytes === 2) return bytes.readUint16('% bytes follow (ASN.1)');
  if (lengthBytes === 3) return bytes.readUint24('% bytes follow (ASN.1)');
  if (lengthBytes === 4) return bytes.readUint32('% bytes follow (ASN.1)');
  throw new Error(`ASN.1 length fields are only supported up to 4 bytes (this one is ${lengthBytes} bytes)`);
}

function readASN1OID(bytes: Bytes) {  // starting with length (i.e. after OID type value)
  const OIDLength = readASN1Length(bytes);
  const [endOID, OIDRemainingBytes] = bytes.expectLength(OIDLength);
  const byte1 = bytes.readUint8();
  const oid = [Math.floor(byte1 / 40), byte1 % 40];
  while (OIDRemainingBytes() > 0) {  // loop over numbers in OID
    let value = 0;
    while (true) {  // loop over bytes in number
      const nextByte = bytes.readUint8();
      value <<= 7;
      value += nextByte & 0x7f;
      if (nextByte < 0x80) break;
    }
    oid.push(value);
  }
  endOID();
  return oid.join('.');
}

function parseUTCTime(s: string) {
  const parts = s.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
  if (!parts) throw new Error('Unrecognised UTC time format in certificate validity');
  const [, yr2dstr, mth, dy, hr, min, sec] = parts;
  const yr2d = parseInt(yr2dstr, 10);
  const yr = yr2d + (yr2d >= 70 ? 1900 : 2000);  // TODO: where do we put the cut-off?
  const date = new Date(`${yr}-${mth}-${dy}T${hr}:${min}:${sec}Z`);  // ISO8601 should be safe
  return date;
}

function parseSeqOfSetOfSeq(cb: Bytes, seqType: string) {
  cb.expectUint8(constructedUniversalTypeSequence, `constructed universal type: sequence (${seqType})`);
  const seqLength = readASN1Length(cb);
  const [endSeq, seqRemainingBytes] = cb.expectLength(seqLength);

  while (seqRemainingBytes() > 0) {
    cb.expectUint8(constructedUniversalTypeSet, 'constructed universal type: set');
    const itemSetLength = readASN1Length(cb);
    const [endItemSet] = cb.expectLength(itemSetLength);

    cb.expectUint8(constructedUniversalTypeSequence, 'constructed universal type: sequence');
    const itemSeqLength = readASN1Length(cb);
    const [endItemSeq] = cb.expectLength(itemSeqLength);

    cb.expectUint8(universalTypeOID, 'universal type: OID');
    const itemOID = readASN1OID(cb);
    cb.comment(`OID: ${itemOID} = ${rdnmap[itemOID]}`);

    const valueType = cb.readUint8();
    if (valueType === universalTypePrintableString) {
      cb.comment('universal type: printable string');
    } else if (valueType === universalTypeUTF8String) {
      cb.comment('universal type: UTF8 string');
    } else {
      throw new Error(`Unexpected item type in certificate ${seqType}: 0x${hexFromU8([valueType])}`);
    }
    const itemStringLength = readASN1Length(cb);
    const [endItemString] = cb.expectLength(itemStringLength);
    const itemString = cb.readUTF8String(itemStringLength);
    endItemString();

    endItemSeq();
    endItemSet();
  }
  endSeq();
}

export function parseCert(certData: Uint8Array) {
  const cb = new Bytes(certData);

  cb.expectUint8(constructedUniversalTypeSequence, 'constructed universal type: sequence (certificate)');
  const certSeqLength = readASN1Length(cb);
  const [endCertSeq] = cb.expectLength(certSeqLength);

  cb.expectUint8(constructedUniversalTypeSequence, 'constructed universal type: sequence (certificate info)');
  const certInfoSeqLength = readASN1Length(cb);
  const [endCertInfoSeq] = cb.expectLength(certInfoSeqLength);

  cb.expectBytes([0xa0, 0x03, 0x02, 0x01, 0x02], 'certificate version v3');  // must be v3 to have extensions

  cb.expectUint8(universalTypeInteger, 'universal type: integer');
  const serialNumberLength = readASN1Length(cb);
  const [endSerialNumber] = cb.expectLength(serialNumberLength);
  const serialNumber = cb.subarray(serialNumberLength);
  cb.comment('serial number');
  endSerialNumber();

  cb.expectUint8(constructedUniversalTypeSequence, 'constructed universal type: sequence (algorithm)');
  const algoLength = readASN1Length(cb);
  const [endAlgo, algoRemainingBytes] = cb.expectLength(algoLength);
  cb.expectUint8(universalTypeOID, 'universal type: OID');
  const algoOID = readASN1OID(cb);
  cb.comment(`algorithm OID: ${algoOID} = ${algomap[algoOID]}`);
  if (algoRemainingBytes() > 0) {
    cb.expectUint8(universalTypeNull, 'universal type: null');
    cb.expectUint8(0x00, 'null length');
  }
  endAlgo();

  parseSeqOfSetOfSeq(cb, 'issuer');

  cb.expectUint8(constructedUniversalTypeSequence, 'constructed universal type: sequence (validity)');
  const validitySeqLength = readASN1Length(cb);
  const [endValiditySeq] = cb.expectLength(validitySeqLength);

  cb.expectUint8(universalTypeUTCTime, 'universal type: UTC time (not before)');
  const notBeforeTimeLength = readASN1Length(cb);
  const [endNotBeforeTime] = cb.expectLength(notBeforeTimeLength);
  const notBeforeTimeStr = cb.readUTF8String(notBeforeTimeLength);
  const notBeforeTime = parseUTCTime(notBeforeTimeStr);
  cb.comment('= ' + notBeforeTime.toISOString());
  endNotBeforeTime();
  cb.expectUint8(universalTypeUTCTime, 'universal type: UTC time (not after)');
  const notAfterTimeLength = readASN1Length(cb);
  const [endNotAfterTime] = cb.expectLength(notAfterTimeLength);
  const notAfterTimeStr = cb.readUTF8String(notBeforeTimeLength);
  const notAfterTIme = parseUTCTime(notAfterTimeStr);
  cb.comment('= ' + notAfterTIme.toISOString());
  endNotAfterTime();
  endValiditySeq();

  parseSeqOfSetOfSeq(cb, 'subject');

  // endCertInfoSeq()

  // ... signature stuff ...

  // endCertSeq();

  chatty && log(...highlightCommented(cb.commentedString(true), LogColours.server));
}

export function decodePEM(pem: string, tag = "[A-Z0-9 ]+") {
  const pattern = new RegExp(`-{5}BEGIN ${tag}-{5}([a-zA-Z0-9=+\\/\\n\\r]+)-{5}END ${tag}-{5}`, 'g');
  const res = [];
  let matches = null;
  while (matches = pattern.exec(pem)) {
    const base64 = matches[1].replace(/[\r\n]/g, '');
    res.push(base64Decode(base64));
  }
  return res;
}

export function getRootCerts() {
  return decodePEM(isrgrootx1 + isrgrootx2 + trustidx3root + cloudflare).map(ber => pkijs.Certificate.fromBER(ber));
}

export function getSubjectAltNamesDNSNames(cert: pkijs.Certificate) {
  const subjectAltNameID = '2.5.29.17';
  const subectAltNameTypeDNSName = 2;
  const sanExtension = cert.extensions?.find(ext => ext.extnID === subjectAltNameID);
  if (sanExtension === undefined) return [];

  const altNames = (sanExtension.parsedValue as pkijs.AltName).altNames
    .filter(altName => altName.type === subectAltNameTypeDNSName)
    .map(altName => altName.value as string);

  return altNames;
}

export function certNamesMatch(host: string, certNames: string[]) {
  return certNames.some(cert => {
    let certName = cert;
    let hostName = host;

    // wildcards: https://en.wikipedia.org/wiki/Wildcard_certificate
    // TODO: what about longer TLDs, such as .co.uk?
    if (/[.][^.]+[.][^.]+/.test(certName) && certName.startsWith('*.')) {
      certName = certName.slice(1);
      hostName = hostName.slice(hostName.indexOf('.'));
    }

    // test
    if (certName === hostName) {
      chatty && log(`matched "${host}" to subjectAltName "${cert}"`);
      return true;
    }
  });
}

export function describeCert(cert: pkijs.Certificate) {
  const validity = `${cert.notBefore.value.toISOString()} — ${cert.notAfter.value.toISOString()}`;
  const issuer = cert.issuer.typesAndValues.map(typeAndValue => {
    const typeval = rdnmap[typeAndValue.type] ?? typeAndValue.type;
    const subjval = typeAndValue.value.valueBlock.value;
    return `${typeval}=${subjval}`;
  }).join(' ');
  const subject = cert.subject.typesAndValues.map(typeAndValue => {
    const typeval = rdnmap[typeAndValue.type] ?? typeAndValue.type;
    const subjval = typeAndValue.value.valueBlock.value;
    return `${typeval}=${subjval}`;
  }).join(' ');
  const altNames = getSubjectAltNamesDNSNames(cert);
  const altNameField = altNames.length === 0 ? '' : `subjectAltNames: ${altNames.join(', ')}\n`;
  const signatureAlgorithm = algomap[cert.signatureAlgorithm.algorithmId] ?? cert.signatureAlgorithm.algorithmId;
  return `subject: ${subject}\n${altNameField}issuer: ${issuer}\nvalidity: ${validity}\nsignature algorithm: ${signatureAlgorithm}`;
}