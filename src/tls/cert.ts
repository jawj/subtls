import * as pkijs from 'pkijs';

import { base64Decode } from '../util/base64';
import { hexFromU8 } from '../util/hex';
import { ASN1Bytes } from '../util/asn1bytes';

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

const universalTypeBoolean = 0x01;
const universalTypeInteger = 0x02;
const constructedUniversalTypeSequence = 0x30;
const constructedUniversalTypeSet = 0x31;
const universalTypeOID = 0x06;
const universalTypePrintableString = 0x13;
const universalTypeUTF8String = 0x0c;
const universalTypeUTCTime = 0x17;
const universalTypeNull = 0x05;
const universalTypeOctetString = 0x04;
const universalTypeBitString = 0x03;
const constructedContextSpecificType = 0xa3;
const dNSName = 0x82;

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
  "1.2.840.113549.1.9.1": "E-mail",
};

const keymap: Record<string, string> = {
  "1.2.840.10045.2.1": "ECPublicKey",
  "1.2.840.10045.3.1.7": "secp256r1",
  "1.3.132.0.34": "secp384r1",
  "1.2.840.113549.1.1.1": "RSAES-PKCS1-v1_5",
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
  "1.2.840.113549.1.1.13": "SHA512 with RSA",
};

const extmap: Record<string, string> = {
  "2.5.29.15": "KeyUsage",
  "2.5.29.37": "ExtKeyUsage",
  "2.5.29.19": "BasicConstraints",
  "2.5.29.14": "SubjectKeyIdentifier",
  "2.5.29.35": "AuthorityKeyIdentifier",
  "1.3.6.1.5.5.7.1.1": "AuthorityInfoAccess",
  "2.5.29.17": "SubjectAltName",
  "2.5.29.32": "CertificatePolicies",
  "1.3.6.1.4.1.11129.2.4.2": "SignedCertificateTimestampList",
  "2.5.29.31": "CRLDistributionPoints",
};

const extKeyUsageMap: Record<string, string> = {
  "1.3.6.1.5.5.7.3.2": "TLSCLientAuth",
  "1.3.6.1.5.5.7.3.1": "TLSServerAuth",
};



function intFromBitString(bs: Uint8Array) {
  const { length } = bs;
  if (length > 4) throw new Error(`Bit string length ${length} would overflow JS bit operators`);
  // implement bigIntFromBitString if longer is needed
  let result = 0;
  let leftShift = 0;
  for (let i = bs.length - 1; i >= 0; i--) {
    result |= bs[i] << leftShift;
    leftShift += 8;
  }
  return result;
}

function readSeqOfSetOfSeq(cb: ASN1Bytes, seqType: string) {  // used for issuer and subject
  cb.expectUint8(constructedUniversalTypeSequence, `sequence (${seqType})`);
  const [endSeq, seqRemainingBytes] = cb.expectASN1Length('sequence');

  while (seqRemainingBytes() > 0) {
    cb.expectUint8(constructedUniversalTypeSet, 'set');
    const itemSetLength = cb.readASN1Length();
    const [endItemSet] = cb.expectLength(itemSetLength);

    cb.expectUint8(constructedUniversalTypeSequence, 'sequence');
    const itemSeqLength = cb.readASN1Length();
    const [endItemSeq] = cb.expectLength(itemSeqLength);

    cb.expectUint8(universalTypeOID, 'OID');
    const itemOID = cb.readASN1OID();
    cb.comment(`= ${rdnmap[itemOID]}`);

    const valueType = cb.readUint8();
    if (valueType === universalTypePrintableString) {
      cb.comment('printable string');
    } else if (valueType === universalTypeUTF8String) {
      cb.comment('UTF8 string');
    } else {
      throw new Error(`Unexpected item type in certificate ${seqType}: 0x${hexFromU8([valueType])}`);
    }
    const itemStringLength = cb.readASN1Length();
    const [endItemString] = cb.expectLength(itemStringLength);
    const itemString = cb.readUTF8String(itemStringLength);
    endItemString();

    endItemSeq();
    endItemSet();
  }
  endSeq();
}

export function parseCert(certData: Uint8Array) {
  const cb = new ASN1Bytes(certData);

  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (certificate)');
  const certSeqLength = cb.readASN1Length();
  const [endCertSeq] = cb.expectLength(certSeqLength);

  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (certificate info)');
  const certInfoSeqLength = cb.readASN1Length();
  const [endCertInfoSeq] = cb.expectLength(certInfoSeqLength);

  cb.expectBytes([0xa0, 0x03, 0x02, 0x01, 0x02], 'certificate version v3');  // must be v3 to have extensions


  cb.expectUint8(universalTypeInteger, 'integer');
  const serialNumberLength = cb.readASN1Length();
  const [endSerialNumber] = cb.expectLength(serialNumberLength);
  const serialNumber = cb.subarray(serialNumberLength);
  cb.comment('serial number');
  endSerialNumber();


  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (algorithm)');
  const algoLength = cb.readASN1Length();
  const [endAlgo, algoRemainingBytes] = cb.expectLength(algoLength);
  cb.expectUint8(universalTypeOID, 'OID');
  const algoOID = cb.readASN1OID();
  cb.comment(`= ${algomap[algoOID]}`);
  if (algoRemainingBytes() > 0) {  // null parameters
    cb.expectUint8(universalTypeNull, 'null');
    cb.expectUint8(0x00, 'null length');
  }
  endAlgo();


  readSeqOfSetOfSeq(cb, 'issuer');


  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (validity)');
  const validitySeqLength = cb.readASN1Length();
  const [endValiditySeq] = cb.expectLength(validitySeqLength);
  cb.expectUint8(universalTypeUTCTime, 'UTC time (not before)');
  const notBeforeTime = cb.readASN1UTCTime();
  cb.expectUint8(universalTypeUTCTime, 'UTC time (not after)');
  const notAfterTime = cb.readASN1UTCTime();
  endValiditySeq();


  readSeqOfSetOfSeq(cb, 'subject');


  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (public key)');
  const publicKeySeqLength = cb.readASN1Length();
  const [endPublicKeySeq] = cb.expectLength(publicKeySeqLength);

  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (public key params)');
  const keyParamsLength = cb.readASN1Length();
  const [endKeyOID, keyOIDRemainingBytes] = cb.expectLength(keyParamsLength);

  while (keyOIDRemainingBytes() > 0) {
    const keyParamRecordType = cb.readUint8();
    if (keyParamRecordType === universalTypeOID) {
      cb.comment('OID');
      const keyOID = cb.readASN1OID();
      cb.comment(`= ${keymap[keyOID]}`)

    } else if (keyParamRecordType === universalTypeNull) {
      cb.comment('null');
      cb.expectUint8(0x00, 'null length');
    }
  }
  endKeyOID();

  cb.expectUint8(universalTypeBitString, 'bit string');
  const publicKey = cb.readASN1BitString();
  cb.comment('public key');

  endPublicKeySeq();


  cb.expectUint8(constructedContextSpecificType, 'constructed context-specific type');
  const extsDataLength = cb.readASN1Length();
  const [endExtsData] = cb.expectLength(extsDataLength);
  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (extensions)');
  const extsLength = cb.readASN1Length();
  const [endExts, extsBytesRemaining] = cb.expectLength(extsLength);

  while (extsBytesRemaining() > 0) {
    cb.expectUint8(constructedUniversalTypeSequence, 'sequence');
    const extLength = cb.readASN1Length();
    const [endExt, extBytesRemaining] = cb.expectLength(extLength);
    cb.expectUint8(universalTypeOID, 'OID (extension type)');
    const extOID = cb.readASN1OID();
    cb.comment(`= ${extmap[extOID]}`);

    if (extOID === "2.5.29.17") {  // subjectAltName
      cb.expectUint8(universalTypeOctetString, 'octet string');
      const sanDerDocLength = cb.readASN1Length();
      const [endSanDerDoc] = cb.expectLength(sanDerDocLength);
      cb.expectUint8(constructedUniversalTypeSequence, 'sequence');
      const sanSeqLength = cb.readASN1Length();
      const [endSanSeq, sanSeqBytesRemaining] = cb.expectLength(sanSeqLength);
      while (sanSeqBytesRemaining() > 0) {
        const nameType = cb.readUint8('GeneralName type');
        const sanNameLength = cb.readASN1Length();
        const [endSanName] = cb.expectLength(sanNameLength);
        if (nameType === dNSName) {
          const sanName = cb.readUTF8String(sanNameLength);
          cb.comment('= DNS name');
        } else {
          cb.skip(sanNameLength, 'unparsed name data');
        }
        endSanName();
      }
      endSanSeq();
      endSanDerDoc();

    } else if (extOID === '2.5.29.15') {  // keyUsage
      cb.expectUint8(universalTypeBoolean, 'boolean');
      const critical = cb.readASN1Boolean();
      cb.comment('<- critical');
      cb.expectUint8(universalTypeOctetString, 'octet string');
      const keyUsageDerLength = cb.readASN1Length();
      const [endKeyUsageDer] = cb.expectLength(keyUsageDerLength);
      cb.expectUint8(universalTypeBitString, 'bit string');
      const keyUsage = cb.readASN1BitString();
      const keyUsageInt = intFromBitString(keyUsage);
      const allKeyUsages = [
        // https://www.rfc-editor.org/rfc/rfc3280#section-4.2.1.3
        'digitalSignature', // (0)
        'nonRepudiation',   // (1)
        'keyEncipherment',  // (2)
        'dataEncipherment', // (3)
        'keyAgreement',     // (4)
        'keyCertSign',      // (5)
        'cRLSign',          // (6)
        'encipherOnly',     // (7)
        'decipherOnly',     // (8)
      ];
      const keyUsages = new Set(allKeyUsages.filter((u, i) => keyUsageInt & (1 << i)));
      cb.comment(`key usage: ${keyUsage} = ${[...keyUsages]}`);
      endKeyUsageDer();

    } else if (extOID === '2.5.29.37') {  // extKeyUsage
      cb.expectUint8(universalTypeOctetString, 'octet string');
      const extKeyUsageDerLength = cb.readASN1Length();
      const [endExtKeyUsageDer] = cb.expectLength(extKeyUsageDerLength);
      cb.expectUint8(constructedUniversalTypeSequence, 'sequence');
      const extKeyUsageLength = cb.readASN1Length();
      const [endExtKeyUsage, extKeyUsageRemainingBytes] = cb.expectLength(extKeyUsageLength);
      while (extKeyUsageRemainingBytes() > 0) {
        cb.expectUint8(universalTypeOID, 'OID');
        const extKeyUsageOID = cb.readASN1OID();
        cb.comment(`= ${extKeyUsageMap[extKeyUsageOID]}`)
      }
      endExtKeyUsage();
      endExtKeyUsageDer();

    } else {

      cb.skip(extBytesRemaining(), 'unparsed extension data');
    }

    endExt();
  }

  endExts();
  endExtsData();


  endCertInfoSeq();

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