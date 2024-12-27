
import { ASN1Bytes } from '../util/asn1bytes';

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
  extAccessMethodOIDMap,
  certPolOIDMap,
  certPolQualOIDMap,
  algorithmWithOID,
  intFromBitString,
  readNamesSeq,
  readSeqOfSetOfSeq,
  descriptionForAlgorithm,
  universalTypeIA5String,
  universalTypeGeneralizedTime,
} from './certUtils';

import { hexFromU8, u8FromHex } from '../util/hex';
import { GrowableData } from '../util/array';
import { fromBase64 } from 'hextreme';

type OID = string;

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
] as const;

export type CertJSON = ReturnType<typeof Cert.prototype.toJSON>;
export type DistinguishedName = Record<string, string | string[]>

interface RootCertsIndex {
  offsets: number[];
  subjects: Record<string, number>;
}

type RootCertsData = Uint8Array;

export interface RootCertsDatabase {
  index: RootCertsIndex;
  data: RootCertsData;
}

export class Cert {
  serialNumber: Uint8Array;
  algorithm: OID;
  issuer: DistinguishedName;
  validityPeriod: { notBefore: Date; notAfter: Date };
  subject: DistinguishedName;
  publicKey: { identifiers: OID[]; data: Uint8Array; all: Uint8Array };
  signature: Uint8Array;
  keyUsage?: { critical?: boolean; usages: Set<typeof allKeyUsages[number]> };
  subjectAltNames?: string[];
  extKeyUsage?: { clientTls?: true; serverTls?: true };
  authorityKeyIdentifier?: Uint8Array;
  subjectKeyIdentifier?: Uint8Array;
  basicConstraints?: { critical?: boolean; ca?: boolean; pathLength?: number } | undefined;
  // nameConstraints?: { critical?: boolean; permitted?: string[]; excluded?: string[] };
  signedData: Uint8Array;
  rawData: Uint8Array;

  static distinguishedNamesAreEqual(dn1: DistinguishedName, dn2: DistinguishedName) {
    return this.stringFromDistinguishedName(dn1) === this.stringFromDistinguishedName(dn2);
  }

  static stringFromDistinguishedName(dn: DistinguishedName) {
    return Object.entries(dn)
      .map(([k, vs]) =>
        typeof vs === 'string' ? `${k}=${vs.trim().replace(/[\\,]/g, '\\$&')}` :
          vs.map(v => `${k}=${v.trim().replace(/[\\,]/g, '\\$&')}`).join(', ')
      ).join(', ');
  }

  constructor(certData: Uint8Array | ASN1Bytes | CertJSON) {
    if (certData instanceof ASN1Bytes || certData instanceof Uint8Array) {
      const cb = certData instanceof ASN1Bytes ? certData : new ASN1Bytes(certData);
      const certSeqStartOffset = cb.offset;

      cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (certificate)');
      const [endCertSeq] = cb.expectASN1Length(chatty && 'certificate sequence');

      const tbsCertStartOffset = cb.offset;

      cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (certificate info)');
      const [endCertInfoSeq] = cb.expectASN1Length(chatty && 'certificate info');

      cb.expectBytes([0xa0, 0x03, 0x02, 0x01, 0x02], chatty && 'certificate version 3');  // must be v3 to have extensions

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
      chatty && cb.comment(`${this.algorithm} = ${descriptionForAlgorithm(algorithmWithOID(this.algorithm))}`);
      if (algoRemaining() > 0) {  // null parameters
        cb.expectUint8(universalTypeNull, chatty && 'null');
        cb.expectUint8(0x00, chatty && 'null length');
      }
      endAlgo();

      // issuer
      this.issuer = readSeqOfSetOfSeq(cb, 'issuer');

      // validity
      let notBefore, notAfter;
      cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (validity)');
      const [endValiditySeq] = cb.expectASN1Length(chatty && 'validity sequence');

      const startTimeType = cb.readUint8();
      if (startTimeType === universalTypeUTCTime) {
        chatty && cb.comment('UTC time (not before)');
        notBefore = cb.readASN1UTCTime();
      } else if (startTimeType === universalTypeGeneralizedTime) {
        chatty && cb.comment('generalized time (not before)');
        notBefore = cb.readASN1GeneralizedTime();
      } else {
        throw new Error(`Unexpected validity start type 0x${hexFromU8([startTimeType])}`);
      }

      const endTimeType = cb.readUint8();
      if (endTimeType === universalTypeUTCTime) {
        chatty && cb.comment('UTC time (not after)');
        notAfter = cb.readASN1UTCTime();
      } else if (endTimeType === universalTypeGeneralizedTime) {
        chatty && cb.comment('generalized time (not after)');
        notAfter = cb.readASN1GeneralizedTime();
      } else {
        throw new Error(`Unexpected validity end type 0x${hexFromU8([endTimeType])}`);
      }

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
          chatty && cb.comment(`${keyOID} = ${keyOIDMap[keyOID]}`)
          publicKeyOIDs.push(keyOID);

        } else if (keyParamRecordType === universalTypeNull) {
          chatty && cb.comment('null');
          cb.expectUint8(0x00, chatty && 'null length');
        }
      }
      endKeyOID();

      cb.expectUint8(universalTypeBitString, chatty && 'bit string');
      const publicKeyData = cb.readASN1BitString();
      chatty && cb.comment('public key');

      this.publicKey = { identifiers: publicKeyOIDs, data: publicKeyData, all: cb.data.subarray(publicKeyStartOffset, cb.offset) };

      endPublicKeySeq();

      // extensions
      cb.expectUint8(constructedContextSpecificType, chatty && 'constructed context-specific type: extensions');
      const [endExtsData] = cb.expectASN1Length();
      cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (certificate extensions)');
      const [endExts, extsRemaining] = cb.expectASN1Length(chatty && 'sequence');

      while (extsRemaining() > 0) {
        cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (certificate extension)');
        const [endExt, extRemaining] = cb.expectASN1Length();
        cb.expectUint8(universalTypeOID, chatty && 'OID (extension type)');
        const extOID = cb.readASN1OID();
        chatty && cb.comment(`${extOID} = ${extOIDMap[extOID]}`);

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
          let keyUsageCritical;
          let nextType = cb.readUint8();
          if (nextType === universalTypeBoolean) {
            chatty && cb.comment('boolean');
            keyUsageCritical = cb.readASN1Boolean(chatty && 'critical: %');
            nextType = cb.readUint8();
          }
          if (nextType !== universalTypeOctetString) throw new Error(`Expected 0x${hexFromU8([universalTypeOctetString])}, got 0x${hexFromU8([nextType])}`);
          chatty && cb.comment('octet string');
          const [endKeyUsageDer] = cb.expectASN1Length(chatty && 'DER document');
          cb.expectUint8(universalTypeBitString, chatty && 'bit string');
          const keyUsageBitStr = cb.readASN1BitString();
          const keyUsageBitmask = intFromBitString(keyUsageBitStr);
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
            chatty && cb.comment(`${extKeyUsageOID} = ${extKeyUsageOIDMap[extKeyUsageOID]}`);
            if (extKeyUsageOID === '1.3.6.1.5.5.7.3.1') this.extKeyUsage.serverTls = true;
            if (extKeyUsageOID === '1.3.6.1.5.5.7.3.2') this.extKeyUsage.clientTls = true;
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

            } else if (authKeyIdDatumType === (contextSpecificType | 1)) {
              chatty && cb.comment('context-specific type: authority cert issuer');
              const [endAuthKeyIdCertIssuer, authKeyIdCertIssuerRemaining] = cb.expectASN1Length(chatty && 'authority cert issuer');
              cb.skip(authKeyIdCertIssuerRemaining(), chatty && 'ignored');
              endAuthKeyIdCertIssuer();

            } else if (authKeyIdDatumType === (contextSpecificType | 2)) {
              chatty && cb.comment('context-specific type: authority cert serial number');
              const [endAuthKeyIdCertSerialNo, authKeyIdCertSerialNoRemaining] = cb.expectASN1Length(chatty && 'authority cert issuer or authority cert serial number');
              cb.skip(authKeyIdCertSerialNoRemaining(), chatty && 'ignored');
              endAuthKeyIdCertSerialNo();

            } else if (authKeyIdDatumType === (contextSpecificType | 33)) {  // where is this documented?!
              chatty && cb.comment('context-specific type: DirName');
              const [endDirName, dirNameRemaining] = cb.expectASN1Length(chatty && 'DirName');
              cb.skip(dirNameRemaining(), chatty && 'ignored');
              chatty && console.log(cb.commentedString());
              endDirName();

            } else {
              throw new Error(`Unexpected data type ${authKeyIdDatumType} in authorityKeyIdentifier certificate extension`);
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
          let basicConstraintsCritical;
          let bcNextType = cb.readUint8();
          if (bcNextType === universalTypeBoolean) {
            chatty && cb.comment('boolean');
            basicConstraintsCritical = cb.readASN1Boolean(chatty && 'critical: %');
            bcNextType = cb.readUint8();
          }
          if (bcNextType !== universalTypeOctetString) throw new Error('Unexpected type in certificate basic constraints');
          chatty && cb.comment('octet string');
          const [endBasicConstraintsDer] = cb.expectASN1Length(chatty && 'DER document');
          cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
          const [endConstraintsSeq, constraintsSeqRemaining] = cb.expectASN1Length();

          let basicConstraintsCa = undefined;
          if (constraintsSeqRemaining() > 0) {
            cb.expectUint8(universalTypeBoolean, chatty && 'boolean');
            basicConstraintsCa = cb.readASN1Boolean(chatty && 'certificate authority: %');
          }

          let basicConstraintsPathLength;
          if (constraintsSeqRemaining() > 0) {
            cb.expectUint8(universalTypeInteger, chatty && 'integer');
            const maxPathLengthLength = cb.readASN1Length(chatty && 'max path length');
            basicConstraintsPathLength =
              maxPathLengthLength === 1 ? cb.readUint8() :
                maxPathLengthLength === 2 ? cb.readUint16() :
                  maxPathLengthLength === 3 ? cb.readUint24() :
                    undefined;
            if (basicConstraintsPathLength === undefined) throw new Error('Too many bytes in max path length in certificate basicConstraints');
            chatty && cb.comment('max path length');
          }

          endConstraintsSeq();
          endBasicConstraintsDer();

          this.basicConstraints = {
            critical: basicConstraintsCritical,
            ca: basicConstraintsCa,
            pathLength: basicConstraintsPathLength,
          }

        } else if (chatty && extOID === '1.3.6.1.5.5.7.1.1') {  // authorityInfoAccess -- only parsed for annotation purposes
          cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
          const [endAuthInfoAccessDER] = cb.expectASN1Length(chatty && 'DER document');

          cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
          const [endAuthInfoAccessSeq, authInfoAccessSeqRemaining] = cb.expectASN1Length(chatty && 'sequence');

          while (authInfoAccessSeqRemaining() > 0) {
            cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
            const [endAuthInfoAccessInnerSeq] = cb.expectASN1Length(chatty && 'sequence');

            cb.expectUint8(universalTypeOID, chatty && 'OID');
            const accessMethodOID = cb.readASN1OID();
            chatty && cb.comment(`${accessMethodOID} = access method: ${extAccessMethodOIDMap[accessMethodOID] ?? 'unknown method'} `)

            cb.expectUint8(contextSpecificType | GeneralName.uniformResourceIdentifier, chatty && 'context-specific type: URI');
            const [endMethodURI, methodURIRemaining] = cb.expectASN1Length(chatty && 'access location');
            cb.readUTF8String(methodURIRemaining());
            endMethodURI();

            endAuthInfoAccessInnerSeq()
          }

          endAuthInfoAccessSeq();
          endAuthInfoAccessDER();

        } else if (chatty && extOID === '2.5.29.32') {  // certificatePolicies -- only parsed for annotation purposes
          cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
          const [endCertPolDER] = cb.expectASN1Length(chatty && 'DER document');

          cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (CertificatePolicies)');
          const [endCertPolSeq, certPolSeqRemaining] = cb.expectASN1Length(chatty && 'sequence');

          while (certPolSeqRemaining() > 0) {
            cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (PolicyInformation)');
            const [endCertPolInnerSeq, certPolInnerSeqRemaining] = cb.expectASN1Length(chatty && 'sequence');

            cb.expectUint8(universalTypeOID, chatty && 'OID (CertPolicyID)');
            const certPolOID = cb.readASN1OID();
            chatty && cb.comment(`${certPolOID} = policy: ${certPolOIDMap[certPolOID] ?? 'unknown policy'} `);

            while (certPolInnerSeqRemaining() > 0) {
              cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence');
              const [endCertPolInner2Seq, certPolInner2SeqRemaining] = cb.expectASN1Length(chatty && 'sequence');

              while (certPolInner2SeqRemaining() > 0) {
                cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (PolicyQualifierInformation)');
                const [endCertPolInner3Seq, certPolInner3SeqRemaining] = cb.expectASN1Length(chatty && 'sequence');

                cb.expectUint8(universalTypeOID, chatty && 'OID (policyQualifierId)');
                const certPolQualOID = cb.readASN1OID();
                chatty && cb.comment(`${certPolQualOID} = qualifier: ${certPolQualOIDMap[certPolQualOID] ?? 'unknown qualifier'} `)

                const qualType = cb.readUint8();
                if (chatty && qualType === universalTypeIA5String) {
                  cb.comment('IA5String');
                  const [endQualStr, qualStrRemaining] = cb.expectASN1Length('string');
                  cb.readUTF8String(qualStrRemaining());
                  endQualStr();

                } else {
                  if (certPolInner3SeqRemaining()) cb.skip(certPolInner3SeqRemaining(), 'skipped policy qualifier data');
                }

                endCertPolInner3Seq();
              }

              endCertPolInner2Seq();
            }

            endCertPolInnerSeq();
          }

          endCertPolSeq();
          endCertPolDER();

          // } else if (chatty && extOID === '2.5.29.31') {  // CRLDistributionPoints -- only parsed for annotation purposes
          //   cb.expectUint8(universalTypeOctetString, chatty && 'octet string');
          //   const [endCRLDPDER] = cb.expectASN1Length(chatty && 'DER document');

          //   cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (DistributionPoints)');
          //   const [endCRLDPSeq, CRLDPRemaining] = cb.expectASN1Length(chatty && 'sequence');

          // TODO

        } else {
          /**
           * ignored extensions include:
           * - Name Constraints -- important! see https://bettertls.com/
           * - CRL Distribution Points -- started implementation above
           * - Signed Certificate Timestamp (SCT) List
           */
          // TODO: check for criticality, throw if critical
          cb.skip(extRemaining(), chatty && 'ignored extension data');
        }

        endExt();
      }

      endExts();
      endExtsData();

      endCertInfoSeq();

      // to-be-signed cert data: https://crypto.stackexchange.com/questions/42345/what-information-is-signed-by-a-certification-authority
      this.signedData = cb.data.subarray(tbsCertStartOffset, cb.offset);

      // signature algorithm
      cb.expectUint8(constructedUniversalTypeSequence, chatty && 'sequence (signature algorithm)');
      const [endSigAlgo, sigAlgoRemaining] = cb.expectASN1Length(chatty && 'signature algorithm sequence');
      cb.expectUint8(universalTypeOID, chatty && 'OID');
      const sigAlgoOID = cb.readASN1OID(chatty && '% (must be same as above)');
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

      this.rawData = cb.data.subarray(certSeqStartOffset, cb.offset);

    } else {
      this.serialNumber = u8FromHex(certData.serialNumber);
      this.algorithm = certData.algorithm;
      this.issuer = certData.issuer;
      this.validityPeriod = {
        notBefore: new Date(certData.validityPeriod.notBefore),
        notAfter: new Date(certData.validityPeriod.notAfter),
      };
      this.subject = certData.subject;
      this.publicKey = {
        identifiers: certData.publicKey.identifiers,
        data: u8FromHex(certData.publicKey.data),
        all: u8FromHex(certData.publicKey.all),
      };
      this.signature = u8FromHex(certData.signature);
      this.keyUsage = {
        critical: certData.keyUsage.critical,
        usages: new Set(certData.keyUsage.usages),
      };
      this.subjectAltNames = certData.subjectAltNames;
      this.extKeyUsage = certData.extKeyUsage;
      if (certData.authorityKeyIdentifier) this.authorityKeyIdentifier = u8FromHex(certData.authorityKeyIdentifier);
      if (certData.subjectKeyIdentifier) this.subjectKeyIdentifier = u8FromHex(certData.subjectKeyIdentifier);
      this.basicConstraints = certData.basicConstraints;
      this.signedData = u8FromHex(certData.signedData);
      this.rawData = u8FromHex(certData.rawData);
    }
  }

  subjectAltNameMatchingHost(host: string) {
    const twoDotRegex = /[.][^.]+[.][^.]+$/;
    return (this.subjectAltNames ?? []).find(cert => {
      let certName = cert;
      let hostName = host;

      // wildcards: https://en.wikipedia.org/wiki/Wildcard_certificate
      if (twoDotRegex.test(host) && twoDotRegex.test(certName) && certName.startsWith('*.')) {
        certName = certName.slice(1);
        hostName = hostName.slice(hostName.indexOf('.'));
      }

      if (certName === hostName) return true;
    });
  }

  isValidAtMoment(moment = new Date()) {
    return moment >= this.validityPeriod.notBefore && moment <= this.validityPeriod.notAfter;
  }

  description() {
    return 'subject: ' + Cert.stringFromDistinguishedName(this.subject) +
      (this.subjectAltNames ? '\nsubject alt names: ' + this.subjectAltNames.join(', ') : '') +
      (this.subjectKeyIdentifier ? `\nsubject key id: ${hexFromU8(this.subjectKeyIdentifier, ' ')}` : '') +
      '\nissuer: ' + Cert.stringFromDistinguishedName(this.issuer) +
      (this.authorityKeyIdentifier ? `\nauthority key id: ${hexFromU8(this.authorityKeyIdentifier, ' ')}` : '') +
      '\nvalidity: ' + this.validityPeriod.notBefore.toISOString() + ' – ' + this.validityPeriod.notAfter.toISOString() + ` (${this.isValidAtMoment() ? 'currently valid' : 'not valid'})` +
      (this.keyUsage ? `\nkey usage (${this.keyUsage.critical ? 'critical' : 'non-critical'}): ` +
        [...this.keyUsage.usages].join(', ') : '') +
      (this.extKeyUsage ? `\nextended key usage: TLS server — ${this.extKeyUsage.serverTls}, TLS client — ${this.extKeyUsage.clientTls}` : '') +
      (this.basicConstraints ? `\nbasic constraints (${this.basicConstraints.critical ? 'critical' : 'non-critical'}): ` +
        `CA — ${this.basicConstraints.ca}, path length — ${this.basicConstraints.pathLength}` : '') +
      '\nsignature algorithm: ' + descriptionForAlgorithm(algorithmWithOID(this.algorithm));
  }

  toJSON() {
    return {
      serialNumber: hexFromU8(this.serialNumber),
      algorithm: this.algorithm,
      issuer: this.issuer,
      validityPeriod: {
        notBefore: this.validityPeriod.notBefore.toISOString(),
        notAfter: this.validityPeriod.notAfter.toISOString(),
      },
      subject: this.subject,
      publicKey: {
        identifiers: this.publicKey.identifiers,
        data: hexFromU8(this.publicKey.data),
        all: hexFromU8(this.publicKey.all),
      },
      signature: hexFromU8(this.signature),
      keyUsage: {
        critical: this.keyUsage?.critical,
        usages: [...(this.keyUsage?.usages ?? [])],
      },
      subjectAltNames: this.subjectAltNames,
      extKeyUsage: this.extKeyUsage,
      authorityKeyIdentifier: this.authorityKeyIdentifier && hexFromU8(this.authorityKeyIdentifier),
      subjectKeyIdentifier: this.subjectKeyIdentifier && hexFromU8(this.subjectKeyIdentifier),
      basicConstraints: this.basicConstraints,
      signedData: hexFromU8(this.signedData),
      rawData: hexFromU8(this.rawData),
    }
  }

  static uint8ArraysFromPEM(pem: string) {
    const tag = "[A-Z0-9 ]+";
    const pattern = new RegExp(`-----BEGIN ${tag}-----([a-zA-Z0-9=+\\/\\n\\r]+)-----END ${tag}-----`, 'g');
    const res = [];
    let matches = null;
    while (matches = pattern.exec(pem)) {
      const base64 = matches[1].replace(/[\r\n]/g, '');
      const binary = fromBase64(base64);
      res.push(binary);
    }
    return res;
  }

  static fromPEM(pem: string) {
    return this.uint8ArraysFromPEM(pem).map(arr => new this(arr));
  }
}

export class TrustedCert extends Cert {
  static databaseFromPEM(pem: string): RootCertsDatabase {  // not efficient: if passing many certs, use saved results
    const certsData = this.uint8ArraysFromPEM(pem);
    const offsets = [0];
    const subjects: Record<string, number> = {};
    const growable = new GrowableData();
    for (const certData of certsData) {
      const cert = new this(certData);
      const offsetIndex = offsets.length - 1;
      if (cert.subjectKeyIdentifier) subjects[hexFromU8(cert.subjectKeyIdentifier)] = offsetIndex;
      subjects[this.stringFromDistinguishedName(cert.subject)] = offsetIndex;
      growable.append(certData);
      offsets[offsets.length] = offsets[offsetIndex] + certData.length;
    }
    const data = growable.getData();
    return { index: { offsets, subjects }, data };
  }

  static findInDatabase(subjectOrSubjectKeyId: DistinguishedName | string, db: RootCertsDatabase) {
    const { index: { subjects, offsets }, data } = db;
    const key = typeof subjectOrSubjectKeyId === 'string' ?
      subjectOrSubjectKeyId : Cert.stringFromDistinguishedName(subjectOrSubjectKeyId);

    const offsetIndex = subjects[key];
    if (offsetIndex === undefined) return;

    const start = offsets[offsetIndex];
    const end = offsets[offsetIndex + 1];
    const certData = data.subarray(start, end);
    const cert = new this(certData);

    return cert;
  }
}
