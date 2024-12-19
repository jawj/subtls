const cs = typeof crypto !== 'undefined' && crypto.subtle !== undefined ?
  Promise.resolve(crypto.subtle) :  // browsers and Node 19+
  import('crypto').then(c => c.webcrypto.subtle);  // Node 15 – 18

function cryptoMethod(method: string, args: any[]) {
  return cs.then((cs: any) => cs[method](...args));
}

export default new Proxy({}, {
  get(target, property: string, receiver) {
    return (...args: any[]) => cryptoMethod(property, args);
  }
}) as SubtleCrypto;
