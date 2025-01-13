import { ASN1Bytes } from '../util/asn1bytes';
import { hexFromU8 } from '../util/hex';

export const universalTypeBoolean = 0x01;
export const universalTypeInteger = 0x02;
export const constructedUniversalTypeSequence = 0x30;
export const constructedUniversalTypeSet = 0x31;
export const universalTypeOID = 0x06;
export const universalTypePrintableString = 0x13;
export const universalTypeTeletexString = 0x14;
export const universalTypeUTF8String = 0x0c;
export const universalTypeIA5String = 0x16;
export const universalTypeUTCTime = 0x17;
export const universalTypeGeneralizedTime = 0x18;
export const universalTypeNull = 0x05;
export const universalTypeOctetString = 0x04;
export const universalTypeBitString = 0x03;
export const constructedContextSpecificType = 0xa3;  // context-specific is 0x80 (1 in bit 8, 0 in bit 7); constructed is 0x20 (1 in bit 6)
export const contextSpecificType = 0x80;

export enum GeneralName {
  otherName = 0x00,                  // [0] OTHER NAME
  rfc822Name = 0x01,                 // [1] IA5String
  dNSName = 0x02,                    // [2] IA5String
  x400Address = 0x03,                // [3] ORAddress
  directoryName = 0x04,              // [4] Name
  ediPartyName = 0x05,               // [5] EDIPartyName
  uniformResourceIdentifier = 0x06,  // [6] IA5String
  iPAddress = 0x07,                  // [7] OCTET STRING
  registeredID = 0x08,               // [8] OBJECT IDENTIFIER
}

export const DNOIDMap: Record<string, string> = {
  "2.5.4.6": "C",   // country
  "2.5.4.10": "O",  // organisation
  "2.5.4.11": "OU", // organisational unit
  "2.5.4.3": "CN",  // common name
  "2.5.4.7": "L",   // locality
  "2.5.4.8": "ST",  // state/province
  "2.5.4.12": "T",  // title
  "2.5.4.42": "GN", // given name
  "2.5.4.43": "I",  // initials
  "2.5.4.4": "SN",  // surname
  "1.2.840.113549.1.9.1": "MAIL",
  "2.5.4.5": "SERIALNUMBER",
};

export const keyOIDMap: Record<string, string> = {
  "1.2.840.10045.2.1": "ECPublicKey",
  "1.2.840.10045.3.1.7": "secp256r1",
  "1.3.132.0.34": "secp384r1",
  "1.2.840.113549.1.1.1": "RSAES-PKCS1-v1_5",
};

export const extOIDMap: Record<string, string> = {
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
  "2.5.29.31": "CRLDistributionPoints (Certificate Revocation List)",
};

export const extKeyUsageOIDMap: Record<string, string> = {
  "1.3.6.1.5.5.7.3.2": "TLSClientAuth",
  "1.3.6.1.5.5.7.3.1": "TLSServerAuth",
};

export const extAccessMethodOIDMap: Record<string, string> = {
  '1.3.6.1.5.5.7.48.1': 'OCSP',
  '1.3.6.1.5.5.7.48.2': 'certificate authority issuers',
};

export const certPolOIDMap: Record<string, string> = {
  '2.23.140.1.2.1': 'domain validated',
  '2.23.140.1.2.2': 'subject identity validated',
  '1.3.6.1.4.1.44947.1.1.1': 'ISRG domain validated',
}

export const certPolQualOIDMap: Record<string, string> = {
  '1.3.6.1.5.5.7.2.1': 'Certificate Practice Statement',
}

export function intFromBitString(bs: Uint8Array) {
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

export async function readSeqOfSetOfSeq(cb: ASN1Bytes, seqType: string) {  // used for issuer and subject
  const result: Record<string, string | string[]> = {};

  await cb.expectUint8(constructedUniversalTypeSequence, chatty && `sequence (${seqType})`);
  const [endSeq, seqRemaining] = await cb.expectASN1Length(chatty && 'sequence');

  while (seqRemaining() > 0) {
    await cb.expectUint8(constructedUniversalTypeSet, chatty && 'set');
    const [endItemSet] = await cb.expectASN1Length(chatty && 'set');

    await cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
    const [endItemSeq] = await cb.expectASN1Length(chatty && 'sequence');

    await cb.expectUint8(universalTypeOID, chatty && 'OID');
    const itemOID = await cb.readASN1OID();
    const itemName = DNOIDMap[itemOID] ?? itemOID;
    chatty && cb.comment(`${itemOID} = ${itemName}`);

    const valueType = await cb.readUint8();
    if (valueType === universalTypePrintableString) {
      chatty && cb.comment('printable string');
    } else if (valueType === universalTypeUTF8String) {
      chatty && cb.comment('UTF8 string');
    } else if (valueType === universalTypeIA5String) {
      chatty && cb.comment('IA5 string');
    } else if (valueType === universalTypeTeletexString) {
      chatty && cb.comment('Teletex string');
    } else {
      throw new Error(`Unexpected item type in certificate ${seqType}: 0x${hexFromU8([valueType])}`);
    }
    const [endItemString, itemStringRemaining] = await cb.expectASN1Length(chatty && 'UTF8 string');
    const itemValue = await cb.readUTF8String(itemStringRemaining());
    endItemString();

    endItemSeq();
    endItemSet();

    const existingValue = result[itemName];
    if (existingValue === undefined) result[itemName] = itemValue;
    else if (typeof existingValue === 'string') result[itemName] = [existingValue, itemValue];
    else existingValue.push(itemValue);
  }

  endSeq();
  return result;
}

export async function readNamesSeq(cb: ASN1Bytes, typeUnionBits = 0x00) {
  const names = [];
  const [endNamesSeq, namesSeqRemaining] = await cb.expectASN1Length(chatty && 'names sequence');
  while (namesSeqRemaining() > 0) {
    const type = await cb.readUint8(chatty && 'GeneralNames type');
    const [endName, nameRemaining] = await cb.expectASN1Length(chatty && 'name');
    let name;
    if (type === (typeUnionBits | GeneralName.dNSName)) {
      name = await cb.readUTF8String(nameRemaining());
      chatty && cb.comment('= DNS name');
    } else {
      name = await cb.readBytes(nameRemaining());
      chatty && cb.comment(`= name (type 0x${hexFromU8([type])})`)
    }
    names.push({ name, type });
    endName();
  }
  endNamesSeq();
  return names;
}

export function algorithmWithOID(oid: string): any {
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
    "1.2.840.10045.2.1": {  // dupes
      name: "ECDSA",
      hash: {
        name: "SHA-1"
      }
    },
    "1.2.840.10045.4.1": {  // dupes
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
      name: "ECDSA", hash: {
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
    },
  }[oid];

  if (algo === undefined) throw new Error(`Unsupported algorithm identifier: ${oid}`);
  return algo;
}

function _descriptionForAlgorithm(algo: any, desc: string[] = []) {
  Object.values(algo).forEach(value => {
    if (typeof value === 'string') desc = [...desc, value];
    else desc = _descriptionForAlgorithm(value, desc);
  });
  return desc;
}

export function descriptionForAlgorithm(algo: any) {
  return _descriptionForAlgorithm(algo).join(' / ');
}