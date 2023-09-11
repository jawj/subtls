import { connect } from 'cloudflare:sockets';

export default {
  async fetch(req, env, ctx) {
    // various sanity checks
    if (req.method !== 'GET') return new Response('Expected GET request', { status: 405 });

    const upgradeHeader = req.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') return new Response('Expected header: "Upgrade: websocket"', { status: 426 });

    const url = new URL(req.url);
    const address = url.searchParams.get('address');
    if (typeof address !== 'string') return new Response('Expected search param: ?address=example.com:443', { status: 400 });

    const addressRegExp = env.ADDRESS_REGEXP;
    if (!addressRegExp) return new Response('Environment variable ADDRESS_REGEXP not set', { status: 500 });
    if (!new RegExp(addressRegExp).test(address)) return new Response('Address is not permitted', { status: 400 });

    // open TCP socket
    const socket = connect(address);
    const socketWriter = socket.writable.getWriter();

    // open WebSocket
    const { 0: wsClient, 1: wsServer } = new WebSocketPair();
    wsServer.accept();

    // deal with data from WebSocket to TCP
    wsServer.addEventListener('message', event => { 
      socketWriter.write(event.data);
    });
    wsServer.addEventListener('close', () => {
      socket.close();
    });

    // deal with data from TCP to WebSocket
    const wsWritableStream = new WritableStream({
      write(chunk) {
        wsServer.send(chunk);
      },
      close() { 
        wsServer.close(1000 /* normal closure */, 'TCP connection closed');
      },
      abort(reason) {
        wsServer.close(1001 /* endpoint going away */, reason);
      },
    });
    const pipe = socket.readable.pipeTo(wsWritableStream);
    
    // don't quit yet
    ctx.waitUntil(pipe);

    // return WebSocket to client
    return new Response(null, { status: 101, webSocket: wsClient });
  },
};
