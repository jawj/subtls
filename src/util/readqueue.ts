import type { Socket } from 'net';

interface DataRequest {
  bytes: number;
  resolve: (data: Uint8Array | undefined) => void;
}

enum WebSocketReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

abstract class ReadQueue {
  queue: Uint8Array[];
  outstandingRequest: DataRequest | undefined;

  constructor() {
    this.queue = [];
  }

  abstract socketIsNotClosed(): boolean;

  enqueue(data: Uint8Array) {
    this.queue.push(data);
    this.dequeue();
  }

  dequeue() {
    if (this.outstandingRequest === undefined) return;

    let { resolve, bytes } = this.outstandingRequest;
    const bytesInQueue = this.bytesInQueue();
    if (bytesInQueue < bytes && this.socketIsNotClosed()) return;  // if socket remains open, wait until requested data size is available

    bytes = Math.min(bytes, bytesInQueue);
    if (bytes === 0) return resolve(undefined);

    this.outstandingRequest = undefined;

    const firstItem = this.queue[0];
    const firstItemLength = firstItem.length;

    if (firstItemLength === bytes) {
      this.queue.shift();
      return resolve(firstItem);

    } else if (firstItemLength > bytes) {
      this.queue[0] = firstItem.subarray(bytes);
      return resolve(firstItem.subarray(0, bytes));

    } else {  // i.e. firstItem.length < bytes
      const result = new Uint8Array(bytes);
      let outstandingBytes = bytes;
      let offset = 0;

      while (outstandingBytes > 0) {
        const nextItem = this.queue[0];
        const nextItemLength = nextItem.length;
        if (nextItemLength <= outstandingBytes) {
          this.queue.shift();
          result.set(nextItem, offset);
          offset += nextItemLength;
          outstandingBytes -= nextItemLength;

        } else {  // nextItemLength > outstandingBytes
          this.queue[0] = nextItem.subarray(outstandingBytes);
          result.set(nextItem.subarray(0, outstandingBytes), offset);
          outstandingBytes -= outstandingBytes;  // i.e. zero
          offset += outstandingBytes;  // not technically necessary
        }
      }
      return resolve(result);
    }
  }

  bytesInQueue() {
    return this.queue.reduce((memo, arr) => memo + arr.length, 0);
  }

  async read(bytes: number) {
    if (this.outstandingRequest !== undefined) throw new Error('Can’t read while already awaiting read');
    return new Promise((resolve: (data: Uint8Array | undefined) => void) => {
      this.outstandingRequest = { resolve, bytes };
      this.dequeue();
    });
  }
}


export class WebSocketReadQueue extends ReadQueue {

  constructor(private socket: WebSocket) {
    super();
    socket.addEventListener('message', (msg: any) => this.enqueue(new Uint8Array(msg.data)));
    socket.addEventListener('close', () => this.dequeue());
  }

  socketIsNotClosed() {
    const { socket } = this;
    const { readyState } = socket;
    return readyState <= WebSocketReadyState.OPEN;
  }
}

export class SocketReadQueue extends ReadQueue {

  constructor(private socket: Socket) {
    super();
    socket.on('data', (data: Buffer) => this.enqueue(new Uint8Array(data)));
    socket.on('close', () => this.dequeue());
  }

  socketIsNotClosed() {
    const { socket } = this;
    const { readyState } = socket;
    return readyState === 'opening' || readyState === 'open';
  }
}
