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

const DNOIDMap: Record<string, string> = {
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

const keyOIDMap: Record<string, string> = {
  "1.2.840.10045.2.1": "ECPublicKey",
  "1.2.840.10045.3.1.7": "secp256r1",
  "1.3.132.0.34": "secp384r1",
  "1.2.840.113549.1.1.1": "RSAES-PKCS1-v1_5",
};

const algoOIDMap: Record<string, string> = {
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

const extOIDMap: Record<string, string> = {
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

const extKeyUsageOIDMap: Record<string, string> = {
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
  const result: Record<string, string> = {};

  cb.expectUint8(constructedUniversalTypeSequence, `sequence (${seqType})`);
  const [endSeq, seqRemaining] = cb.expectASN1Length('sequence');

  while (seqRemaining() > 0) {
    cb.expectUint8(constructedUniversalTypeSet, 'set');
    const [endItemSet] = cb.expectASN1Length('set');

    cb.expectUint8(constructedUniversalTypeSequence, 'sequence');
    const [endItemSeq] = cb.expectASN1Length('sequence');

    cb.expectUint8(universalTypeOID, 'OID');
    const itemOID = cb.readASN1OID();
    const itemName = DNOIDMap[itemOID] ?? itemOID;
    cb.comment(`= ${itemName}`);

    const valueType = cb.readUint8();
    if (valueType === universalTypePrintableString) {
      cb.comment('printable string');
    } else if (valueType === universalTypeUTF8String) {
      cb.comment('UTF8 string');
    } else {
      throw new Error(`Unexpected item type in certificate ${seqType}: 0x${hexFromU8([valueType])}`);
    }
    const [endItemString, itemStringRemaining] = cb.expectASN1Length('UTF8 string');
    const itemValue = cb.readUTF8String(itemStringRemaining());
    endItemString();

    endItemSeq();
    endItemSet();

    if (result[itemName] !== undefined) throw new Error(`Duplicate OID ${itemName} in certificate ${seqType}`);
    result[itemName] = itemValue;
  }

  endSeq();
  return result;
}

export function parseCert(certData: Uint8Array) {
  const cb = new ASN1Bytes(certData);
  const cert: Record<string, any> = {};

  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (certificate)');
  const [endCertSeq] = cb.expectASN1Length('certificate sequence');

  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (certificate info)');
  const [endCertInfoSeq] = cb.expectASN1Length('certificate info');

  cb.expectBytes([0xa0, 0x03, 0x02, 0x01, 0x02], 'certificate version v3');  // must be v3 to have extensions

  // serial number
  cb.expectUint8(universalTypeInteger, 'integer');
  const [endSerialNumber, serialNumberRemaining] = cb.expectASN1Length('serial number');
  cert.serialNumber = cb.subarray(serialNumberRemaining());
  cb.comment('serial number');
  endSerialNumber();

  // algorithm
  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (algorithm)');
  const [endAlgo, algoRemaining] = cb.expectASN1Length('algorithm sequence');
  cb.expectUint8(universalTypeOID, 'OID');
  cert.algorithm = cb.readASN1OID();
  cb.comment(`= ${algoOIDMap[cert.algorithm]}`);
  if (algoRemaining() > 0) {  // null parameters
    cb.expectUint8(universalTypeNull, 'null');
    cb.expectUint8(0x00, 'null length');
  }
  endAlgo();

  // issuer
  cert.issuer = readSeqOfSetOfSeq(cb, 'issuer');

  // validity
  cert.validityPeriod = {};
  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (validity)');
  const [endValiditySeq] = cb.expectASN1Length('validity sequence');
  cb.expectUint8(universalTypeUTCTime, 'UTC time (not before)');
  cert.validityPeriod.notBefore = cb.readASN1UTCTime();
  cb.expectUint8(universalTypeUTCTime, 'UTC time (not after)');
  cert.validityPeriod.notAfter = cb.readASN1UTCTime();
  endValiditySeq();

  // subject
  cert.subject = readSeqOfSetOfSeq(cb, 'subject');

  // public key
  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (public key)');
  const [endPublicKeySeq] = cb.expectASN1Length('public key sequence');

  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (public key params)');
  const [endKeyOID, keyOIDRemaining] = cb.expectASN1Length('public key params sequence');

  cert.publicKey = { OIDs: [] };
  while (keyOIDRemaining() > 0) {
    const keyParamRecordType = cb.readUint8();
    if (keyParamRecordType === universalTypeOID) {
      cb.comment('OID');
      const keyOID = cb.readASN1OID();
      cert.publicKey.OIDs.push(keyOID);
      cb.comment(`= ${keyOIDMap[keyOID]}`)

    } else if (keyParamRecordType === universalTypeNull) {
      cb.comment('null');
      cb.expectUint8(0x00, 'null length');
    }
  }
  endKeyOID();

  cb.expectUint8(universalTypeBitString, 'bit string');
  cert.publicKey.data = cb.readASN1BitString();
  cb.comment('public key');

  endPublicKeySeq();

  // extensions
  cb.expectUint8(constructedContextSpecificType, 'constructed context-specific type');
  const [endExtsData] = cb.expectASN1Length();
  cb.expectUint8(constructedUniversalTypeSequence, 'sequence (extensions)');
  const [endExts, extsRemaining] = cb.expectASN1Length('extensions sequence');

  while (extsRemaining() > 0) {
    cb.expectUint8(constructedUniversalTypeSequence, 'sequence');
    const [endExt, extRemaining] = cb.expectASN1Length();
    cb.expectUint8(universalTypeOID, 'OID (extension type)');
    const extOID = cb.readASN1OID();
    cb.comment(`= ${extOIDMap[extOID]}`);

    if (extOID === "2.5.29.17") {  // subjectAltName
      cert.subjectAltNames = [];

      cb.expectUint8(universalTypeOctetString, 'octet string');
      const [endSanDerDoc] = cb.expectASN1Length('DER document');
      cb.expectUint8(constructedUniversalTypeSequence, 'sequence (names)');
      const [endSanSeq, sanSeqRemaining] = cb.expectASN1Length('names sequence');
      while (sanSeqRemaining() > 0) {
        const nameType = cb.readUint8('GeneralName type');
        const [endSanName, sanNameRemaining] = cb.expectASN1Length('name');
        if (nameType === dNSName) {
          const sanName = cb.readUTF8String(sanNameRemaining());
          cert.subjectAltNames.push(sanName);
          cb.comment('= DNS name');
        } else {
          cb.skip(sanNameRemaining(), 'unparsed name data');
        }
        endSanName();
      }
      endSanSeq();
      endSanDerDoc();

    } else if (extOID === '2.5.29.15') {  // keyUsage
      cert.keyUsage = {};

      cb.expectUint8(universalTypeBoolean, 'boolean');
      cert.keyUsage.critical = cb.readASN1Boolean();
      cb.comment('<- critical');
      cb.expectUint8(universalTypeOctetString, 'octet string');
      const [endKeyUsageDer] = cb.expectASN1Length('DER document');
      cb.expectUint8(universalTypeBitString, 'bit string');
      const keyUsage = cb.readASN1BitString();
      const keyUsageInt = intFromBitString(keyUsage);
      cert.keyUsage.bitmask = keyUsageInt;
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
      cert.keyUsage.names = keyUsages;
      cb.comment(`key usage: ${keyUsage} = ${[...keyUsages]}`);
      endKeyUsageDer();

    } else if (extOID === '2.5.29.37') {  // extKeyUsage
      cert.extKeyUsage = { OIDs: [] };

      cb.expectUint8(universalTypeOctetString, 'octet string');
      const [endExtKeyUsageDer] = cb.expectASN1Length('DER document');
      cb.expectUint8(constructedUniversalTypeSequence, 'sequence');
      const [endExtKeyUsage, extKeyUsageRemaining] = cb.expectASN1Length('key usage OIDs');
      while (extKeyUsageRemaining() > 0) {
        cb.expectUint8(universalTypeOID, 'OID');
        const extKeyUsageOID = cb.readASN1OID();
        cert.extKeyUsage.OIDs.push(extKeyUsageOID);
        if (extKeyUsageOID === '1.3.6.1.5.5.7.3.1') cert.extKeyUsage.TLSServerCert = true;
        if (extKeyUsageOID === '1.3.6.1.5.5.7.3.2') cert.extKeyUsage.TLSClientCert = true;
        cb.comment(`= ${extKeyUsageOIDMap[extKeyUsageOID]}`)
      }
      endExtKeyUsage();
      endExtKeyUsageDer();

    } else {

      cb.skip(extRemaining(), 'unparsed extension data');
    }

    endExt();
  }

  endExts();
  endExtsData();


  endCertInfoSeq();

  // ... signature stuff ...

  // endCertSeq();

  chatty && log(...highlightCommented(cb.commentedString(true), LogColours.server));
  return cert;
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
    const typeval = DNOIDMap[typeAndValue.type] ?? typeAndValue.type;
    const subjval = typeAndValue.value.valueBlock.value;
    return `${typeval}=${subjval}`;
  }).join(' ');
  const subject = cert.subject.typesAndValues.map(typeAndValue => {
    const typeval = DNOIDMap[typeAndValue.type] ?? typeAndValue.type;
    const subjval = typeAndValue.value.valueBlock.value;
    return `${typeval}=${subjval}`;
  }).join(' ');
  const altNames = getSubjectAltNamesDNSNames(cert);
  const altNameField = altNames.length === 0 ? '' : `subjectAltNames: ${altNames.join(', ')}\n`;
  const signatureAlgorithm = algoOIDMap[cert.signatureAlgorithm.algorithmId] ?? cert.signatureAlgorithm.algorithmId;
  return `subject: ${subject}\n${altNameField}issuer: ${issuer}\nvalidity: ${validity}\nsignature algorithm: ${signatureAlgorithm}`;
}