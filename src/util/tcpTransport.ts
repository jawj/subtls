import { Socket } from 'net';
import { SocketReadQueue } from './readQueue';

export default async function tcpTransport(host: string, port: string | number, close = () => { }) {
  const socket = new Socket();
  await new Promise<void>(resolve => socket.connect(Number(port), host, resolve));
  socket.on('error', (err: any) => { console.log('socket error:', err); });
  socket.on('close', close);
  const reader = new SocketReadQueue(socket);
  const stats = { read: 0, written: 0 };
  const read: typeof reader.read = (bytes, readMode) => {
    stats.read += bytes;
    return reader.read(bytes, readMode);
  };
  const write: typeof socket.write = (data: any) => {
    stats.written += data.byteLength ?? data.size ?? data.length;
    return socket.write(data);
  };
  return { read, write, stats };
}
