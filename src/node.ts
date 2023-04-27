// @ts-ignore
import { webcrypto } from 'crypto';
globalThis.crypto = webcrypto as any;

import tcpTransport from './util/tcpTransport';

const iterations = 1;
const { https } = await import('./https');

for (let i = 0; i < iterations; i++) {
  const html = await https('https://subtls.pages.dev', 'GET', tcpTransport);
  !chatty && console.log(html);

  if (i < iterations - 1) await new Promise(resolve => setTimeout(resolve, 500));
}
