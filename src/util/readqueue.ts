interface DataRequest {
  bytes: number;
  resolve: (data: Uint8Array) => void;
}

export class ReadQueue {
  queue: Uint8Array[];
  outstandingRequest: DataRequest | undefined;

  constructor(ws: WebSocket) {
    this.queue = [];
    ws.addEventListener('message', (msg) => this.enqueue(new Uint8Array(msg.data)));
  }

  enqueue(data: Uint8Array) {
    this.queue.push(data);
    this.dequeue();
  }

  dequeue() {
    if (this.outstandingRequest === undefined) return;
    const { resolve, bytes } = this.outstandingRequest;
    const bytesInQueue = this.bytesInQueue();
    if (bytesInQueue < bytes) return;
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
      return result;
    }
  }

  bytesInQueue() {
    return this.queue.reduce((memo, arr) => memo + arr.length, 0);
  }

  async read(bytes: number) {
    if (this.outstandingRequest !== undefined) throw new Error('Can’t read while already awaiting read');
    return new Promise(resolve => {
      this.outstandingRequest = { resolve, bytes };
      this.dequeue();
    });
  }
}