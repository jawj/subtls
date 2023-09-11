import { WebSocketReadQueue } from "./readqueue";

export default async function wsTransport(host: string, port: string | number, close = () => { }) {
  const ws = await new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(`wss://ws.manipulexity.com/v1?address=${host}:${port}`);
    // const ws = new WebSocket(`wss://subtls-wsproxy.jawj.workers.dev/?address=${host}:${port}`);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (err) => { console.log('ws error:', err); });
    ws.addEventListener('close', () => {
      console.log('connection closed');
      close();
    })
  });
  const reader = new WebSocketReadQueue(ws);
  const read = reader.read.bind(reader);
  const write = ws.send.bind(ws);
  return { read, write };
}
