const subtleCrypto = typeof crypto !== 'undefined' && crypto.subtle !== undefined ?
  Promise.resolve(crypto.subtle) :  // browsers and Node 19+
  import('crypto').then(c => c.webcrypto.subtle);  // Node 15 – 18

function subtleCryptoMethod(method: string, args: any[]) {
  return subtleCrypto.then((cs: any) => cs[method](...args));
}

export default new Proxy({}, {
  get(target, property: string) {
    return (...args: any[]) => subtleCryptoMethod(property, args);
  }
}) as SubtleCrypto;
