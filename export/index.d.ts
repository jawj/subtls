import type { Socket } from 'net';

interface RootCertsIndex {
  offsets: number[];
  subjects: Record<string, number>;
}

type RootCertsData = Uint8Array;

export interface RootCertsDatabase {
  index: RootCertsIndex;
  data: RootCertsData;
}

export class TrustedCert {
  static fromPEM(pem: string): TrustedCert[];
  static databaseFromPEM(pem: string): RootCertsDatabase;
  description(): string;
}

export class WebSocketReadQueue {
  constructor(ws: WebSocket);
  read(bytes: number): Promise<Uint8Array | undefined>;
  bytesInQueue(): number;
}

export class SocketReadQueue {
  constructor(socket: Socket);
  read(bytes: number): Promise<Uint8Array | undefined>;
  bytesInQueue(): number;
}

export function startTls(
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
  },
): Promise<readonly [() => Promise<Uint8Array | undefined>, (data: Uint8Array) => Promise<void>]>;

export function base64Decode(input: string): Uint8Array;
export function u8FromHex(hex: string): Uint8Array;
export function hexFromU8(u8: Uint8Array | number[], spacer?: string): string;
export function stableStringify(
  x: any,
  replacer: (key: string, value: any) => any,
  indent?: string | number
): string;
