import * as pvtsutils from 'pvtsutils';
import * as pkijs from 'pkijs';

// @ts-ignore
import isrgrootx1 from '../roots/isrg-root-x1.pem';
// @ts-ignore
import isrgrootx2 from '../roots/isrg-root-x2.pem';
// @ts-ignore
import trustidx3root from '../roots/trustid-x3-root.pem';
// @ts-ignore
import cloudflare from '../roots/cloudflare.pem';

export function decodePEM(pem: string, tag = "[A-Z0-9 ]+") {
  const pattern = new RegExp(`-{5}BEGIN ${tag}-{5}([a-zA-Z0-9=+\\/\\n\\r]+)-{5}END ${tag}-{5}`, 'g');
  const res = [];
  let matches = null;
  while (matches = pattern.exec(pem)) {
    const base64 = matches[1].replace(/[\r\n]/g, '');
    res.push(pvtsutils.Convert.FromBase64(base64));
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
      console.log(`matched "${host}" to subjectAltName "${cert}"`);
      return true;
    }
  });
}

export function describeCert(cert: pkijs.Certificate) {
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