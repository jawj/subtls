// use this file rather than @cloudflare/workers-types to avoid clashes with lib.dom.d.ts

declare interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
  props: any;
}

declare const WebSocketPair: {
  new(): {
    0: WebSocket & { accept(): void };
    1: WebSocket & { accept(): void };
  };
};

declare interface ResponseInit {
  webSocket?: WebSocket & { accept(): void };
}

declare module 'cloudflare:sockets' {
  export function connect(
    address: string | SocketAddress,
    options?: SocketOptions,
  ): Socket;

  export interface Socket {
    get readable(): ReadableStream;
    get writable(): WritableStream;
    get closed(): Promise<void>;
    get opened(): Promise<SocketInfo>;
    close(): Promise<void>;
    startTls(options?: TlsOptions): Socket;
  }

  export interface SocketAddress {
    hostname: string;
    port: number;
  }

  export interface SocketOptions {
    secureTransport?: string;
    allowHalfOpen: boolean;
    highWaterMark?: number | bigint;
  }

  export interface SocketInfo {
    remoteAddress?: string;
    localAddress?: string;
  }

  export interface TlsOptions {
    expectedServerHostname?: string;
  }
}
