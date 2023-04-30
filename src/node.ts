import { webcrypto } from 'crypto';
globalThis.crypto = webcrypto as any;

import ws from 'ws';
globalThis.WebSocket = ws as any;

const iterations = process.argv[2] ? Number(process.argv[2]) : 1;
const dbUrl = process.argv[3];

if (dbUrl) {
  const { postgres } = await import('./postgres');  // dynamic import picks up globalThis additions
  const { default: wsTransport } = await import('./util/wsTransport');
  for (let i = 0; i < iterations; i++) {
    await postgres(dbUrl, wsTransport);
    if (i < iterations - 1) await new Promise(resolve => setTimeout(resolve, 50));
  }

} else {
  const { https } = await import('./https');  // dynamic import picks up globalThis additions
  const { default: tcpTransport } = await import('./util/tcpTransport');
  for (let i = 0; i < iterations; i++) {
    const html = await https('https://subtls.pages.dev', 'GET', tcpTransport);
    !chatty && console.log(html);
    if (i < iterations - 1) await new Promise(resolve => setTimeout(resolve, 250));
  }
}
