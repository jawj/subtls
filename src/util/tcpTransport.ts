import { Socket } from 'net';
import { ReadQueue } from './readqueue';

export default async function tcpTransport(host: string, port: string | number) {
  const socket = new Socket();
  await new Promise<void>(resolve => socket.connect(Number(port), host, resolve));
  socket.on('error', (err: any) => { console.log('socket error:', err); });
  socket.on('close', () => { console.log('connection closed'); })
  const reader = new ReadQueue(socket);
  const read = reader.read.bind(reader);
  const write = socket.write.bind(socket);
  return { read, write };
}
