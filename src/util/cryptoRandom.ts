const cryptoPromise = typeof crypto !== 'undefined' ?
  Promise.resolve(crypto) :  // browsers and Node 19+
  import('crypto').then(c => c.webcrypto);  // Node 15 – 18

export async function getRandomValues(...args: any[]) {
  const c: any = await cryptoPromise;
  return c.getRandomValues(...args);
}
