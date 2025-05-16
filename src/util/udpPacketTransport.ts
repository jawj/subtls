import { createSocket, type Socket } from 'dgram';

export type SocketTimeout = [number, () => void];

export interface UDPSocketOptions {
  close?: () => void;
  error?: (e: Error) => void;
}

export default async function udpPacketTransport(
  host: string,
  port: string | number,
  opts: UDPSocketOptions = {},
) {
  const socket = createSocket('udp4');
  const packetQueue: Uint8Array[] = [];
  let resolve: any = undefined;

  socket.on('message', (buffer: Buffer) => {
    const data = new Uint8Array(buffer);
    if (resolve) {
      resolve(data);
      resolve = undefined;
    }
    else packetQueue.push(data);
  });

  socket.on('error', (e: any) => {
    if (opts.error) opts.error(e);
    else console.error('socket error:', e);
    socket.close();
  });

  if (opts.close) socket.on('close', opts.close);

  socket.connect(Number(port), host);
  await new Promise<Socket>(resolve => { socket.on('connect', resolve); });

  const stats = { read: 0, written: 0 };

  const read = async () => {  // whole packet by packet
    if (resolve !== undefined) throw new Error('Can’t read while already awaiting read');

    if (packetQueue.length > 0) return packetQueue.shift();
    return new Promise((newResolve: (data: Uint8Array) => void) => {
      resolve = newResolve;
    });
  };

  const write: typeof socket.send = (data: any) => {
    stats.written += data.byteLength ?? data.size ?? data.length;
    return socket.send(data);
  };

  const end = () => socket.close();

  return { read, write, end, stats };
}
