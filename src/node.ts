import { webcrypto } from 'crypto';
import WebSocket from 'ws';

globalThis.crypto = webcrypto as any;
globalThis.WebSocket = WebSocket as any;

const { https } = await import('./https');

for (let i = 0; i < 1; i++) {
  await https('https://subtls.pages.dev', 'GET');
  await new Promise(resolve => setTimeout(resolve, 500));
}
