import { Socket } from 'net';
import { SocketReadQueue } from './readQueue';

export type SocketTimeout = [number, () => void];

export interface SocketOptions {
  close?: () => void;
  error?: (e: Error) => void;
  timeout?: SocketTimeout;
}

export default async function tcpTransport(
  host: string,
  port: string | number,
  { close, timeout, error }: SocketOptions,
) {
  const socket = new Socket();

  if (timeout) {
    const [timeoutMs, timeoutFn] = timeout;
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      timeoutFn();
      socket.end();
    });
  }
  if (close) socket.on('close', close);

  socket.on('error', (e: any) => {
    if (error) error(e);
    else console.error('socket error:', e);
    socket.end();
  });

  await new Promise<void>(resolve => socket.connect(Number(port), host, resolve));

  const reader = new SocketReadQueue(socket);
  const stats = { read: 0, written: 0 };
  const read: typeof reader.read = async (bytes, readMode) => {
    const data = await reader.read(bytes, readMode);
    stats.read += data?.byteLength ?? 0;
    return data;
  };
  const write: typeof socket.write = (data: any) => {
    stats.written += data.byteLength ?? data.size ?? data.length;
    return socket.write(data);
  };
  return { read, write, stats };
}
