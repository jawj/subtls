import { Socket } from 'net';
import { SocketReadQueue } from './readqueue';

export default async function tcpTransport(host: string, port: string | number, close = () => { }) {
  const socket = new Socket();
  await new Promise<void>(resolve => socket.connect(Number(port), host, resolve));
  socket.on('error', (err: any) => { console.log('socket error:', err); });
  socket.on('close', close);
  const reader = new SocketReadQueue(socket);
  const read = reader.read.bind(reader);
  const write = socket.write.bind(socket);
  return { read, write };
}
