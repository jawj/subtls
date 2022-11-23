
import { base64Decode } from '../util/base64';
import { ASN1Bytes } from '../util/asn1bytes';
import { highlightBytes } from '../presentation/highlights';
import { LogColours } from '../presentation/appearance';
import { log } from '../presentation/log';

import {
  universalTypeBitString,
  universalTypeBoolean,
  universalTypeInteger,
  universalTypeNull,
  universalTypeOctetString,
  universalTypeOID,
  universalTypeUTCTime,
  constructedContextSpecificType,
  constructedUniversalTypeSequence,
  contextSpecificType,
  GeneralName,
  extKeyUsageOIDMap,
  extOIDMap,
  keyOIDMap,
  algorithmWithOID,
  intFromBitString,
  readNamesSeq,
  readSeqOfSetOfSeq,
  descriptionForAlgorithm,
} from './certUtils';
import { hexFromU8 } from '../util/hex';


type OID = string;

export class Cert {
  serialNumber: Uint8Array;
  algorithm: OID;
  issuer: Record<string, string>;
  validityPeriod: { notBefore: Date; notAfter: Date };
  subject: Record<string, string>;
  publicKey: { identifiers: OID[]; data: Uint8Array; all: Uint8Array };
  signature: Uint8Array;
  keyUsage?: { critical?: boolean; usages: Set<string> };
  subjectAltNames?: string[];
  extKeyUsage?: { clientTls?: true; serverTls?: true };
  authorityKeyIdentifier?: Uint8Array;
  subjectKeyIdentifier?: Uint8Array;
  basicConstraints?: { critical: boolean; ca?: boolean; pathLength?: number } | undefined;

  constructor(certData: Uint8Array | ASN1Bytes) {
    const cb = certData instanceof ASN1Bytes ? certData : new ASN1Bytes(certData);

    cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (certificate)');
    const [endCertSeq] = cb.expectASN1Length(chatty && 'certificate sequence');

    cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (certificate info)');
    const [endCertInfoSeq] = cb.expectASN1Length(chatty && 'certificate info');

    cb.expectBytes([0xa0, 0x03, 0x02, 0x01, 0x02], chatty && 'certificate version v3');  // must be v3 to have extensions

    // serial number
    cb.expectUint8(universalTypeInteger, chatty && 'integer');
    const [endSerialNumber, serialNumberRemaining] = cb.expectASN1Length(chatty && 'serial number');
    this.serialNumber = cb.subarray(serialNumberRemaining());
    chatty && cb.comment('serial number');
    endSerialNumber();

    // algorithm
    cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (algorithm)');
    const [endAlgo, algoRemaining] = cb.expectASN1Length(chatty && 'algorithm sequence');
    cb.expectUint8(universalTypeOID, chatty && 'OID');
    this.algorithm = cb.readASN1OID();
    chatty && cb.comment(`= ${descriptionForAlgorithm(algorithmWithOID(this.algorithm))}`);
    if (algoRemaining() > 0) {  // null parameters
      cb.expectUint8(universalTypeNull, chatty && 'null');
      cb.expectUint8(0x00, chatty && 'null length');
    }
    endAlgo();

    // issuer
    this.issuer = readSeqOfSetOfSeq(cb, 'issuer');

    // validity
    cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (validity)');
    const [endValiditySeq] = cb.expectASN1Length(chatty && 'validity sequence');
    cb.expectUint8(universalTypeUTCTime, chatty && 'UTC time (not before)');
    const notBefore = cb.readASN1UTCTime();
    cb.expectUint8(universalTypeUTCTime, chatty && 'UTC time (not after)');
    const notAfter = cb.readASN1UTCTime();
    this.validityPeriod = { notBefore, notAfter };
    endValiditySeq();

    // subject
    this.subject = readSeqOfSetOfSeq(cb, 'subject');

    // public key
    const publicKeyStartOffset = cb.offset;
    cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (public key)');
    const [endPublicKeySeq] = cb.expectASN1Length(chatty && 'public key sequence');
    cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (public key params)');
    const [endKeyOID, keyOIDRemaining] = cb.expectASN1Length(chatty && 'public key params sequence');

    const publicKeyOIDs: string[] = [];
    while (keyOIDRemaining() > 0) {
      const keyParamRecordType = cb.readUint8();
      if (keyParamRecordType === universalTypeOID) {
        chatty && cb.comment('OID');
        const keyOID = cb.readASN1OID();
        publicKeyOIDs.push(keyOID);
        chatty && cb.comment(`= ${keyOIDMap[keyOID]}`)

      } else if (keyParamRecordType === universalTypeNull) {
        chatty && cb.comment('null');
        cb.expectUint8(0x00, chatty && 'null length');
      }
    }
    endKeyOID();

    cb.expectUint8(universalTypeBitString, chatty && 'bit string');
    const publicKeyData = cb.readASN1BitString();
    chatty && cb.comment('public key');

    this.publicKey = { identifiers: publicKeyOIDs, data: publicKeyData, all: cb.uint8Array.subarray(publicKeyStartOffset, cb.offset) };

    endPublicKeySeq();

    // extensions
    cb.expectUint8(constructedContextSpecificType, chatty && 'constructed context-specific type');
    const [endExtsData] = cb.expectASN1Length();
    cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (extensions)');
    const [endExts, extsRemaining] = cb.expectASN1Length(chatty && 'extensions sequence');

    while (extsRemaining() > 0) {
      cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
      const [endExt, extRemaining] = cb.expectASN1Length();
      cb.expectUint8(universalTypeOID, chatty && 'OID (extension type)');
      const extOID = cb.readASN1OID();
      chatty && cb.comment(`= ${extOIDMap[extOID]}`);

      if (extOID === "2.5.29.17") {  // subjectAltName
        cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
        const [endSanDerDoc] = cb.expectASN1Length(chatty && 'DER document');
        cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (names)');
        const allSubjectAltNames = readNamesSeq(cb, contextSpecificType);
        this.subjectAltNames = allSubjectAltNames
          .filter((san: any) => san.type === (GeneralName.dNSName | contextSpecificType))
          .map((san: any) => san.name);
        endSanDerDoc();

      } else if (extOID === '2.5.29.15') {  // keyUsage
        cb.expectUint8(universalTypeBoolean, chatty && 'boolean');
        const keyUsageCritical = cb.readASN1Boolean();
        chatty && cb.comment('<- critical');
        cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
        const [endKeyUsageDer] = cb.expectASN1Length(chatty && 'DER document');
        cb.expectUint8(universalTypeBitString, chatty && 'bit string');
        const keyUsageBitStr = cb.readASN1BitString();
        const keyUsageBitmask = intFromBitString(keyUsageBitStr);
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
        const keyUsageNames = new Set(allKeyUsages.filter((u, i) => keyUsageBitmask & (1 << i)));
        chatty && cb.comment(`key usage: ${keyUsageBitmask} = ${[...keyUsageNames]}`);
        endKeyUsageDer();
        this.keyUsage = {
          critical: keyUsageCritical,
          usages: keyUsageNames,
        };

      } else if (extOID === '2.5.29.37') {  // extKeyUsage
        this.extKeyUsage = {};
        cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
        const [endExtKeyUsageDer] = cb.expectASN1Length(chatty && 'DER document');
        cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
        const [endExtKeyUsage, extKeyUsageRemaining] = cb.expectASN1Length(chatty && 'key usage OIDs');
        while (extKeyUsageRemaining() > 0) {
          cb.expectUint8(universalTypeOID, chatty && 'OID');
          const extKeyUsageOID = cb.readASN1OID();
          if (extKeyUsageOID === '1.3.6.1.5.5.7.3.1') this.extKeyUsage.serverTls = true;
          if (extKeyUsageOID === '1.3.6.1.5.5.7.3.2') this.extKeyUsage.clientTls = true;
          chatty && cb.comment(`= ${extKeyUsageOIDMap[extKeyUsageOID]}`)
        }
        endExtKeyUsage();
        endExtKeyUsageDer();

      } else if (extOID === '2.5.29.35') {  // authorityKeyIdentifier
        cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
        const [endAuthKeyIdDer] = cb.expectASN1Length(chatty && 'DER document');
        cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
        const [endAuthKeyIdSeq, authKeyIdSeqRemaining] = cb.expectASN1Length(chatty && 'sequence');

        while (authKeyIdSeqRemaining() > 0) {
          const authKeyIdDatumType = cb.readUint8();
          if (authKeyIdDatumType === (contextSpecificType | 0)) {
            chatty && cb.comment('context-specific type: key identifier');
            const [endAuthKeyId, authKeyIdRemaining] = cb.expectASN1Length(chatty && 'authority key identifier');
            this.authorityKeyIdentifier = cb.readBytes(authKeyIdRemaining());
            chatty && cb.comment('authority key identifier');
            endAuthKeyId();

          } else if (authKeyIdDatumType === (contextSpecificType | 1) || authKeyIdDatumType === (contextSpecificType | 2)) {
            chatty && cb.comment('context-specific type: authority cert issuer or authority cert serial number');
            const [endAuthKeyIdExtra, authKeyIdExtraRemaining] = cb.expectASN1Length(chatty && 'authority cert issuer or authority cert serial number');
            cb.skip(authKeyIdExtraRemaining(), chatty && 'ignored');
            endAuthKeyIdExtra();

          } else {
            throw new Error('Unexpected data type in authorityKeyIdentifier certificate extension');
          }
        }

        endAuthKeyIdSeq();
        endAuthKeyIdDer();

      } else if (extOID === '2.5.29.14') {  // subjectKeyIdentifier
        cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
        const [endSubjectKeyIdDer] = cb.expectASN1Length(chatty && 'DER document');
        cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
        const [endSubjectKeyId, subjectKeyIdRemaining] = cb.expectASN1Length(chatty && 'subject key identifier');
        this.subjectKeyIdentifier = cb.readBytes(subjectKeyIdRemaining());
        chatty && cb.comment('subject key identifier');
        endSubjectKeyId();
        endSubjectKeyIdDer();

      } else if (extOID === '2.5.29.19') {  // basicConstraints
        cb.expectUint8(universalTypeBoolean, chatty && 'boolean');
        const basicConstraintsCritical = cb.readASN1Boolean();
        chatty && cb.comment('<- critical');
        cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
        const [endBasicConstraintsDer] = cb.expectASN1Length(chatty && 'DER document');
        cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
        const [endConstraintsSeq, constraintsSeqRemaining] = cb.expectASN1Length();

        let basicConstraintsCa = undefined;
        if (constraintsSeqRemaining() > 0) {
          cb.expectUint8(universalTypeBoolean, chatty && 'boolean');
          basicConstraintsCa = cb.readASN1Boolean();
        }

        let basicConstraintsPathLength;
        if (constraintsSeqRemaining() > 0) {
          cb.expectUint8(universalTypeInteger, chatty && 'integer');
          const maxPathLengthLength = cb.readASN1Length(chatty && 'max path length');
          const basicConstraintsPathLength =
            maxPathLengthLength === 1 ? cb.readUint8() :
              maxPathLengthLength === 2 ? cb.readUint16() :
                maxPathLengthLength === 3 ? cb.readUint24() :
                  undefined;
          chatty && cb.comment('max path length');
          if (basicConstraintsPathLength === undefined) throw new Error('Too many bytes in max path length in certificate basicConstraints');
        }

        endConstraintsSeq();
        endBasicConstraintsDer();

        this.basicConstraints = {
          critical: basicConstraintsCritical,
          ca: basicConstraintsCa,
          pathLength: basicConstraintsPathLength,
        }

      } else {
        /**
         * ignored extensions include:
         * - CRL Distribution Points
         * - Certificate Policies
         * - Authority Information Access
         * - Signed Certificate Timestamp (SCT) List
         */
        cb.skip(extRemaining(), chatty && 'ignored extension data');
      }

      endExt();
    }

    endExts();
    endExtsData();

    endCertInfoSeq();

    // signature algorithm
    cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (signature algorithm)');
    const [endSigAlgo, sigAlgoRemaining] = cb.expectASN1Length(chatty && 'signature algorithm sequence');
    cb.expectUint8(universalTypeOID, chatty && 'OID');
    const sigAlgoOID = cb.readASN1OID();
    if (sigAlgoRemaining() > 0) {
      cb.expectUint8(universalTypeNull, chatty && 'null');
      cb.expectUint8(0x00, chatty && 'null length');
    }
    endSigAlgo();
    if (sigAlgoOID !== this.algorithm) throw new Error(`Certificate specifies different signature algorithms inside (${this.algorithm}) and out (${sigAlgoOID})`);

    // signature
    cb.expectUint8(universalTypeBitString, chatty && 'bitstring (signature)');
    this.signature = cb.readASN1BitString();
    chatty && cb.comment('signature');

    endCertSeq();
    // chatty && log(...highlightBytes(cb.commentedString(true), LogColours.server));
  }

  static fromPEM(pem: string) {
    const tag = "[A-Z0-9 ]+";
    const pattern = new RegExp(`-{5}BEGIN ${tag}-{5}([a-zA-Z0-9=+\\/\\n\\r]+)-{5}END ${tag}-{5}`, 'g');
    const res = [];
    let matches = null;
    while (matches = pattern.exec(pem)) {
      const base64 = matches[1].replace(/[\r\n]/g, '');
      const binary = base64Decode(base64);
      const cert = new Cert(binary);
      res.push(cert);
    }
    return res;
  }

  subjectAltNamesMatch(host: string) {
    const twoDotRegex = /[.][^.]+[.][^.]+$/;
    return (this.subjectAltNames ?? []).some(cert => {
      let certName = cert;
      let hostName = host;

      // wildcards: https://en.wikipedia.org/wiki/Wildcard_certificate
      if (twoDotRegex.test(host) && twoDotRegex.test(certName) && certName.startsWith('*.')) {
        certName = certName.slice(1);
        hostName = hostName.slice(hostName.indexOf('.'));
      }

      // test
      if (certName === hostName) {
        chatty && log(`%c✓ matched "${host}" to subjectAltName "${cert}"`, 'color: #8c8');
        return true;
      }
    });
  }

  isValidAtMoment(moment = new Date()) {
    return moment >= this.validityPeriod.notBefore && moment <= this.validityPeriod.notAfter;
  }

  description() {
    return 'subject: ' + Object.entries(this.subject).map(x => x.join('=')).join(', ') +
      (this.subjectAltNames ? '\nsubject alt names: ' + this.subjectAltNames.join(', ') : '') +
      (this.subjectKeyIdentifier ? `\nsubject key id: ${hexFromU8(this.subjectKeyIdentifier, ' ')}` : '') +
      '\nissuer: ' + Object.entries(this.issuer).map(x => x.join('=')).join(', ') +
      (this.authorityKeyIdentifier ? `\nauthority key id: ${hexFromU8(this.authorityKeyIdentifier, ' ')}` : '') +
      '\nvalidity: ' + this.validityPeriod.notBefore.toISOString() + ' – ' + this.validityPeriod.notAfter.toISOString() + ` (${this.isValidAtMoment() ? 'currently valid' : 'not valid'})` +
      (this.keyUsage ? `\nkey usage (${this.keyUsage.critical ? 'critical' : 'non-critical'}): ` +
        [...this.keyUsage.usages].join(', ') : '') +
      (this.extKeyUsage ? `\nextended key usage: TLS server — ${this.extKeyUsage.serverTls}, TLS client — ${this.extKeyUsage.clientTls}` : '') +
      (this.basicConstraints ? `\nbasic constraints (${this.basicConstraints.critical ? 'critical' : 'non-critical'}): ` +
        `CA — ${this.basicConstraints.ca}, path length — ${this.basicConstraints.pathLength}` : '') +
      '\nsignature algorithm: ' + descriptionForAlgorithm(algorithmWithOID(this.algorithm));
  }
}

