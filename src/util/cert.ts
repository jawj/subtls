import type { Certificate } from 'pkijs';

export function describeCert(cert: Certificate) {
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
    "1.2.840.113549.1.1.2": "MD2 with RSA",
    "1.2.840.113549.1.1.4": "MD5 with RSA",
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
  const signatureAlgorithm = algomap[cert.signatureAlgorithm.algorithmId] ?? cert.signatureAlgorithm.algorithmId;
  return `subject: ${subject}\nissuer: ${issuer}\nvalidity: ${validity}\nsignature algorithm: ${signatureAlgorithm}`;
}