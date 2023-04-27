export default crypto.subtle;

/*
// this setup allows monitoring/proxying

function cryptoMethod(method: string, args: any[]) {
  return (crypto.subtle as any)[method](...args);
}

export default new Proxy({}, {
  get(target, property: string, receiver) {
    return (...args: any[]) => cryptoMethod(property, args);
  }
}) as SubtleCrypto;
*/
