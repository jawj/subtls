
export declare class TrustedCert {
  static fromPEM(pem: string): TrustedCert[];
  description(): string;
}

export declare function startTls(
  host: string,
  rootCerts: TrustedCert[],
  networkRead: (bytes: number) => Promise<Uint8Array | undefined>,
  networkWrite: (data: Uint8Array) => void,
  useSNI?: boolean,
  writePreData?: Uint8Array,
  expectPreData?: Uint8Array,
): Promise<readonly [() => Promise<Uint8Array>, (data: Uint8Array) => Promise<void>]>;
