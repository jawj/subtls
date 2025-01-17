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
  const stats = { read: 0, written: 0 };
  const read: typeof reader.read = (bytes, readMode) => {
    stats.read += bytes;
    return reader.read(bytes, readMode);
  };
  const write: typeof ws.send = (data: any) => {
    stats.written += data.byteLength ?? data.size ?? data.length;
    return ws.send(data);
  };
  return { read, write, stats };
}
