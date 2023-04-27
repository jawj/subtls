import { webcrypto } from 'crypto';
import tcpTransport from './util/tcpTransport';
// import WebSocket from 'ws';

globalThis.crypto = webcrypto as any;
// globalThis.WebSocket = WebSocket as any;

const { https } = await import('./https');

for (let i = 0; i < 1; i++) {
  await https('https://subtls.pages.dev', 'GET', tcpTransport);
  await new Promise(resolve => setTimeout(resolve, 500));
}
