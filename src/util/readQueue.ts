import type { Socket as TCPSocket } from 'net';
import type { Socket as UDPSocket } from 'dgram';

export enum ReadMode {
  CONSUME = 0,
  PEEK = 1,
}

export interface DataRequest {
  bytes: number;
  resolve: (data: Uint8Array | undefined) => void;
  readMode: ReadMode;
}

enum WebSocketReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

export abstract class ReadQueue {
  queue: Uint8Array[];
  outstandingRequest: DataRequest | undefined;

  constructor() {
    this.queue = [];
  }

  abstract moreDataMayFollow(): boolean;

  enqueue(data: Uint8Array) {
    this.queue.push(data);
    this.dequeue();
  }

  dequeue() {
    if (this.outstandingRequest === undefined) return;

    const { resolve, bytes: requestedBytes, readMode } = this.outstandingRequest;
    const bytesInQueue = this.bytesInQueue();
    if (bytesInQueue < requestedBytes && this.moreDataMayFollow()) return;  // if socket remains open, wait until requested data size is available

    const bytes = Math.min(requestedBytes, bytesInQueue);
    if (bytes === 0) {
      resolve(undefined);
      return;
    }

    this.outstandingRequest = undefined;

    const firstItem = this.queue[0];
    const firstItemLength = firstItem.length;

    if (firstItemLength === bytes) {
      if (readMode === ReadMode.CONSUME) this.queue.shift();
      resolve(firstItem);
      return;
    }

    if (firstItemLength > bytes) {
      if (readMode === ReadMode.CONSUME) this.queue[0] = firstItem.subarray(bytes);
      resolve(firstItem.subarray(0, bytes));
      return;
    }

    // now we know: firstItem.length < bytes
    const result = new Uint8Array(bytes);
    let outstandingBytes = bytes;
    let offset = 0;
    let itemsConsumed = 0;
    while (outstandingBytes > 0) {
      const nextItem = this.queue[itemsConsumed];
      const nextItemLength = nextItem.length;
      if (nextItemLength <= outstandingBytes) {
        itemsConsumed++;
        result.set(nextItem, offset);
        offset += nextItemLength;
        outstandingBytes -= nextItemLength;

      } else {  // nextItemLength > outstandingBytes
        if (readMode === ReadMode.CONSUME) this.queue[itemsConsumed] = nextItem.subarray(outstandingBytes);
        result.set(nextItem.subarray(0, outstandingBytes), offset);
        outstandingBytes -= outstandingBytes;  // i.e. zero
        offset += outstandingBytes;  // not technically necessary
      }
    }

    if (readMode === ReadMode.CONSUME) this.queue.splice(0, itemsConsumed);
    resolve(result);
  }

  bytesInQueue() {
    return this.queue.reduce((memo, arr) => memo + arr.length, 0);
  }

  async read(bytes: number, readMode = ReadMode.CONSUME) {
    if (this.outstandingRequest !== undefined) throw new Error('Can’t read while already awaiting read');
    return new Promise((resolve: (data: Uint8Array | undefined) => void) => {
      this.outstandingRequest = { resolve, bytes, readMode };
      this.dequeue();
    });
  }
}

export class WebSocketReadQueue extends ReadQueue {

  constructor(protected socket: WebSocket) {
    super();
    socket.addEventListener('message', (msg: any) => this.enqueue(new Uint8Array(msg.data)));
    socket.addEventListener('close', () => this.dequeue());
  }

  moreDataMayFollow() {
    const { socket } = this;
    const { readyState } = socket;
    const connecting = readyState as WebSocketReadyState === WebSocketReadyState.CONNECTING;
    const open = readyState as WebSocketReadyState === WebSocketReadyState.OPEN;
    return connecting || open;
  }
}

export class SocketReadQueue extends ReadQueue {

  constructor(protected socket: TCPSocket) {
    super();
    socket.on('data', (data: Buffer) => this.enqueue(new Uint8Array(data)));
    socket.on('close', () => this.dequeue());
  }

  moreDataMayFollow() {
    const { socket } = this;
    const { readyState } = socket;
    return readyState === 'opening' || readyState === 'open';
  }
}

export class UDPSocketReadQueue extends ReadQueue {
  protected socketIsClosed = false;

  constructor(protected socket: UDPSocket) {
    super();
    socket.on('message', (data: Buffer) => this.enqueue(new Uint8Array(data)));
    socket.on('close', () => {
      this.socketIsClosed = true;
      this.dequeue();
    });
  }

  moreDataMayFollow() {
    return !this.socketIsClosed;
  }
}

export interface Uint8ArrayWithFetchPoints extends Uint8Array {
  fetchPoints?: number[];
}

export class LazyReadFunctionReadQueue extends ReadQueue {
  protected dataIsExhausted = false;

  constructor(protected readFn: () => Promise<Uint8Array | undefined>) {
    super();
  }

  override async read(bytes: number, readMode = ReadMode.CONSUME) {
    const fetchPoints = [];
    while (this.bytesInQueue() < bytes) {
      fetchPoints.push(this.bytesInQueue());
      const data = await this.readFn();
      if (data === undefined) {
        this.dataIsExhausted = true;
        break;
      }
      if (data.length > 0) this.enqueue(data);
    }
    const data = await super.read(bytes, readMode) as Uint8ArrayWithFetchPoints;
    data.fetchPoints = fetchPoints;
    return data;
  }

  moreDataMayFollow(): boolean {
    return !this.dataIsExhausted;
  }
}
