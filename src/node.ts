import { getRootCertsDatabase } from './util/rootCerts';
import ws from 'ws';
if (typeof WebSocket === 'undefined') globalThis.WebSocket = ws as any;

const iterations = process.argv[2] ? Number(process.argv[2]) : 1;
const dbUrl = process.argv[3];
const rootCertsPromise = getRootCertsDatabase();

if (dbUrl) {
  const { postgres } = await import('./postgres');  // dynamic import picks up globalThis additions
  const { default: wsTransport } = await import('./util/wsTransport');
  for (let i = 0; i < iterations; i++) {
    await postgres(dbUrl, wsTransport, rootCertsPromise);
    if (i < iterations - 1) await new Promise(resolve => setTimeout(resolve, 50));
  }

} else {
  const { https } = await import('./https');  // dynamic import picks up globalThis additions
  const { default: tcpTransport } = await import('./util/tcpTransport');
  for (let i = 0; i < iterations; i++) {
    const html = await https('https://bytebybyte.dev', 'GET', tcpTransport, rootCertsPromise);
    !chatty && console.log(html);
    if (i < iterations - 1) await new Promise(resolve => setTimeout(resolve, 250));
  }
}
