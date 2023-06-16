import type { Socket } from 'net';

export declare class TrustedCert {
  static fromPEM(pem: string): TrustedCert[];
  description(): string;
}

export declare class WebSocketReadQueue {
  constructor(ws: WebSocket);
  async read(bytes: number): Promise<Uint8Array | undefined>;
  bytesInQueue(): number;
}

export declare class SocketReadQueue {
  constructor(socket: Socket);
  async read(bytes: number): Promise<Uint8Array | undefined>;
  bytesInQueue(): number;
}

export declare function startTls(
  host: string,
  rootCerts: TrustedCert[],
  networkRead: (bytes: number) => Promise<Uint8Array | undefined>,
  networkWrite: (data: Uint8Array) => void,
  options?: {
    useSNI?: boolean,
    requireServerTlsExtKeyUsage?: boolean,
    requireDigitalSigKeyUsage?: boolean,
    writePreData?: Uint8Array,
    expectPreData?: Uint8Array,
    commentPreData?: string,
  } = {},
): Promise<readonly [() => Promise<Uint8Array | undefined>, (data: Uint8Array) => Promise<void>]>;
