import { WebSocketReadQueue } from './readQueue';

export interface WebSocketOptions {
  close?: () => void;
}

export default async function wsTransport(
  host: string,
  port: string | number,
  opts: WebSocketOptions
) {
  const ws = await new Promise<WebSocket>(resolve => {
    const wsURL = location.hostname === 'localhost' ? 'ws://localhost:6544' : 'wss://subtls-wsproxy.jawj.workers.dev';
    const ws = new WebSocket(`${wsURL}/?address=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (err) => { console.log('ws error:', err); });
    if (opts.close) ws.addEventListener('close', opts.close);
  });

  const reader = new WebSocketReadQueue(ws);
  const stats = { read: 0, written: 0 };

  const read: typeof reader.read = async (bytes, readMode) => {
    const data = await reader.read(bytes, readMode);
    stats.read += data?.byteLength ?? 0;
    return data;
  };

  const write: typeof ws.send = (data: any) => {
    stats.written += data.byteLength ?? data.size ?? data.length;
    return ws.send(data);
  };

  const end = (code?: number, reason?: string) => ws.close(code, reason);

  return { read, write, end, stats };
}
