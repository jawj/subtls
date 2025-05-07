import { createSocket, type Socket } from 'dgram';
import { UDPSocketReadQueue } from './readQueue';

export type SocketTimeout = [number, () => void];

export interface UDPSocketOptions {
  close?: () => void;
  error?: (e: Error) => void;
}

export default async function udpTransport(
  host: string,
  port: string | number,
  opts: UDPSocketOptions,
) {
  const socket = createSocket('udp4');

  socket.on('error', (e: any) => {
    if (opts.error) opts.error(e);
    else console.error('socket error:', e);
    socket.close();
  });

  if (opts.close) socket.on('close', opts.close);

  socket.connect(Number(port), host);
  await new Promise<Socket>(resolve => { socket.on('connect', resolve); });

  const reader = new UDPSocketReadQueue(socket);
  const stats = { read: 0, written: 0 };

  const read: typeof reader.read = async (bytes, readMode) => {
    const data = await reader.read(bytes, readMode);
    stats.read += data?.byteLength ?? 0;
    return data;
  };

  const write: typeof socket.send = (data: any) => {
    stats.written += data.byteLength ?? data.size ?? data.length;
    return socket.send(data);
  };

  const end = () => socket.close();

  return { read, write, end, stats };
}
