import { WebSocketReadQueue } from './readQueue';

export default async function wsTransport(host: string, port: string | number, close = () => { }) {
  const ws = await new Promise<WebSocket>(resolve => {
    const wsURL = location.hostname === 'localhost' ? 'ws://localhost:6544' : 'wss://subtls-wsproxy.jawj.workers.dev';
    const ws = new WebSocket(`${wsURL}/?address=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (err) => { console.log('ws error:', err); });
    ws.addEventListener('close', close);
  });
  const reader = new WebSocketReadQueue(ws);
  const read = reader.read.bind(reader);
  const write = ws.send.bind(ws);
  return { read, write };
}
