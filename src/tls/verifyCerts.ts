import { Cert, TrustedCert } from './cert';
import { hexFromU8 } from '../util/hex';
import { equal } from '../util/array';
import { LogColours } from '../presentation/appearance';
import { highlightColonList } from '../presentation/highlights';
import { log } from '../presentation/log';
import { ASN1Bytes } from '../util/asn1bytes';
import { ecdsaVerify } from './ecdsa';
import cs from '../util/cryptoProxy';

export async function verifyCerts(host: string, certs: Cert[], rootCerts: TrustedCert[]) {

  // end-user certificate checks
  chatty && log('%c%s', `color: ${LogColours.header}`, 'certificates received from host');
  for (const cert of certs) chatty && log(...highlightColonList(cert.description()));

  chatty && log('Now we have all the certificates, which are summarised above. First, we do some basic checks on the end-user certificate — i.e. the one this server is presenting as its own:');

  const userCert = certs[0];
  const matchingSubjectAltName = userCert.subjectAltNameMatchingHost(host);
  if (matchingSubjectAltName === undefined) throw new Error(`No matching subjectAltName for ${host}`);
  chatty && log(`%c✓ matched host to subjectAltName "${matchingSubjectAltName}"`, 'color: #8c8;');

  const validNow = userCert.isValidAtMoment();
  if (!validNow) throw new Error('End-user certificate is not valid now');
  chatty && log(`%c✓ end-user certificate is valid now`, 'color: #8c8;');

  if (!userCert.extKeyUsage?.serverTls) throw new Error('End-user certificate has no TLS server extKeyUsage');
  chatty && log(`%c✓ end-user certificate has TLS server extKeyUsage`, 'color: #8c8;');

  // certificate chain checks
  chatty && log('Next, we verify the signature of each certificate using the public key of the next certificate in the chain. This carries on until we find a certificate we can verify using one of our own trusted root certificates (or until we reach the end of the chain and therefore fail):');

  let verifiedToTrustedRoot = false;

  chatty && log('%c%s', `color: ${LogColours.header}`, 'trusted root certificates');
  for (const cert of rootCerts) chatty && log(...highlightColonList(cert.description()));

  for (let i = 0, len = certs.length; i < len; i++) {
    const subjectCert = certs[i];
    const subjectAuthKeyId = subjectCert.authorityKeyIdentifier;
    if (subjectAuthKeyId === undefined) throw new Error('Certificates without an authorityKeyIdentifier are not supported');

    // first, see if any trusted root cert has a subjKeyId matching the authKeyId
    let signingCert: Cert | undefined = rootCerts.find(cert =>
      cert.subjectKeyIdentifier !== undefined && equal(cert.subjectKeyIdentifier, subjectAuthKeyId));

    // if not, try the next supplied certificate
    if (signingCert === undefined) signingCert = certs[i + 1];

    // if we still didn't find a signing certificate, give up
    if (signingCert === undefined) throw new Error('Ran out of certificates before reaching trusted root');

    chatty && log('matched certificates on key id %s', hexFromU8(subjectAuthKeyId, ' '));

    const signingCertIsTrustedRoot = signingCert instanceof TrustedCert;
    if (signingCert.isValidAtMoment() !== true) throw new Error('Signing certificate is not valid now');
    if (signingCert.keyUsage?.usages.has('digitalSignature') !== true) throw new Error('Signing certificate keyUsage does not include digital signatures');
    if (signingCert.basicConstraints?.ca !== true) throw new Error('Signing certificate basicConstraints do not indicate a CA certificate');
    const { pathLength } = signingCert.basicConstraints;
    if (pathLength !== undefined && pathLength < i) throw new Error('Exceeded certificate path length');

    // verify cert chain signature
    chatty && log(`verifying certificate CN "${subjectCert.subject.CN}" is signed by %c${signingCertIsTrustedRoot ? 'trusted root' : 'intermediate'}%c certificate CN "${signingCert.subject.CN}" ...`,
      `background: ${signingCertIsTrustedRoot ? '#ffc' : '#eee'}`, 'background: inherit');

    if (subjectCert.algorithm === '1.2.840.10045.4.3.2' || subjectCert.algorithm === '1.2.840.10045.4.3.3') {  // ECDSA + SHA256/384
      const hash = subjectCert.algorithm === '1.2.840.10045.4.3.2' ? 'SHA-256' : 'SHA-384';
      const signingKeyOIDs = signingCert.publicKey.identifiers;
      const namedCurve = signingKeyOIDs.includes('1.2.840.10045.3.1.7') ? 'P-256' : signingKeyOIDs.includes('1.3.132.0.34') ? 'P-384' : undefined;
      if (namedCurve === undefined) throw new Error('Unsupported signing key curve');

      const sb = new ASN1Bytes(subjectCert.signature);
      await ecdsaVerify(sb, signingCert.publicKey.all, subjectCert.signedData, namedCurve, hash);

    } else if (subjectCert.algorithm === '1.2.840.113549.1.1.11' || subjectCert.algorithm === '1.2.840.113549.1.1.12') {  // RSASSA_PKCS1-v1_5 + SHA-256/384
      const hash = subjectCert.algorithm === '1.2.840.113549.1.1.11' ? 'SHA-256' : 'SHA-384';
      const signatureKey = await cs.importKey('spki', signingCert.publicKey.all, { name: 'RSASSA-PKCS1-v1_5', hash }, false, ['verify']);
      const certVerifyResult = await cs.verify({ name: 'RSASSA-PKCS1-v1_5' }, signatureKey, subjectCert.signature, subjectCert.signedData);
      if (certVerifyResult !== true) throw new Error('RSASSA_PKCS1-v1_5-SHA256 certificate verify failed');
      chatty && log(`%c✓ RSASAA-PKCS1-v1_5 signature verified`, 'color: #8c8;');

    } else {
      throw new Error('Unsupported signing algorithm');
    }

    if (signingCertIsTrustedRoot) {
      verifiedToTrustedRoot = true;
      break;
    }
  }

  return verifiedToTrustedRoot;
}