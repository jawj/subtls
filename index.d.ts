/// <reference types="node" />

import type { Socket } from 'net';

export declare const allKeyUsages: readonly ["digitalSignature", "nonRepudiation", "keyEncipherment", "dataEncipherment", "keyAgreement", "keyCertSign", "cRLSign", "encipherOnly", "decipherOnly"];

export declare class ASN1Bytes extends Bytes {
    readASN1Length(comment?: string): Promise<number>;
    expectASN1Length(comment?: string): Promise<readonly [() => void, () => number]>;
    expectASN1TypeAndLength(typeNum: number, typeDesc: string, comment?: string): Promise<readonly [() => void, () => number]>;
    readASN1OID(comment?: string): Promise<string>;
    readASN1Boolean(comment?: string): Promise<boolean>;
    readASN1UTCTime(comment?: string): Promise<Date>;
    readASN1GeneralizedTime(comment?: string): Promise<Date>;
    readASN1Time(comment?: string): Promise<Date>;
    readASN1BitString(comment?: string): Promise<Uint8Array<ArrayBuffer>>;
    expectASN1Sequence(comment?: string): Promise<readonly [() => void, () => number]>;
    expectASN1OctetString(comment?: string): Promise<readonly [() => void, () => number]>;
    expectASN1DERDoc(): Promise<readonly [() => void, () => number]>;
    expectASN1Null(comment?: string): Promise<void>;
}

export declare class Bytes {
    indent: number;
    fetchFn: undefined | ((bytes: number) => Promise<Uint8Array | undefined>);
    endOfReadableData: number;
    offset: number;
    dataView: DataView;
    data: Uint8Array;
    comments: Record<number, string>;
    indents: Record<number, number>;
    /**
     * @param data -
     * * If data is a `Uint8Array`, this is the initial data
     * * If data is a `number`, this is the initial size in bytes (all zeroes)
     * * If data is a `function`, this function is called to retrieve data when required
     */
    constructor(data?: Uint8Array | number | ((bytes: number) => Promise<Uint8Array | undefined>), indent?: number);
    readRemaining(): number;
    resizeTo(newSize: number): void;
    ensureReadAvailable(bytes: number): Promise<void>;
    ensureWriteAvailable(bytes: number): void;
    expectLength(length: number, indentDelta?: number): readonly [() => void, () => number];
    comment(s: string, offset?: number): this;
    lengthComment(length: number, comment?: string, inclusive?: boolean): string;
    subarrayForRead(length: number): Promise<Uint8Array<ArrayBufferLike>>;
    skipRead(length: number, comment?: string): Promise<this>;
    readBytes(length: number): Promise<Uint8Array<ArrayBuffer>>;
    readUTF8String(length: number): Promise<string>;
    readUTF8StringNullTerminated(): Promise<string>;
    readUint8(comment?: string): Promise<number>;
    readUint16(comment?: string): Promise<number>;
    readUint24(comment?: string): Promise<number>;
    readUint32(comment?: string): Promise<number>;
    expectBytes(expected: Uint8Array | number[], comment?: string): Promise<void>;
    expectUint8(expectedValue: number, comment?: string): Promise<void>;
    expectUint16(expectedValue: number, comment?: string): Promise<void>;
    expectUint24(expectedValue: number, comment?: string): Promise<void>;
    expectUint32(expectedValue: number, comment?: string): Promise<void>;
    expectReadLength(length: number, indentDelta?: number): Promise<readonly [() => void, () => number]>;
    expectLengthUint8(comment?: string): Promise<readonly [() => void, () => number]>;
    expectLengthUint16(comment?: string): Promise<readonly [() => void, () => number]>;
    expectLengthUint24(comment?: string): Promise<readonly [() => void, () => number]>;
    expectLengthUint32(comment?: string): Promise<readonly [() => void, () => number]>;
    expectLengthUint8Incl(comment?: string): Promise<readonly [() => void, () => number]>;
    expectLengthUint16Incl(comment?: string): Promise<readonly [() => void, () => number]>;
    expectLengthUint24Incl(comment?: string): Promise<readonly [() => void, () => number]>;
    expectLengthUint32Incl(comment?: string): Promise<readonly [() => void, () => number]>;
    subarrayForWrite(length: number): Uint8Array<ArrayBufferLike>;
    skipWrite(length: number, comment?: string): this;
    writeBytes(bytes: number[] | Uint8Array): this;
    writeUTF8String(s: string): this;
    writeUTF8StringNullTerminated(s: string): this;
    writeUint8(value: number, comment?: string): Bytes;
    writeUint16(value: number, comment?: string): Bytes;
    writeUint24(value: number, comment?: string): Bytes;
    writeUint32(value: number, comment?: string): Bytes;
    _writeLengthGeneric(lengthBytes: number, inclusive: boolean, comment?: string): () => void;
    writeLengthUint8(comment?: string): () => void;
    writeLengthUint16(comment?: string): () => void;
    writeLengthUint24(comment?: string): () => void;
    writeLengthUint32(comment?: string): () => void;
    writeLengthUint8Incl(comment?: string): () => void;
    writeLengthUint16Incl(comment?: string): () => void;
    writeLengthUint24Incl(comment?: string): () => void;
    writeLengthUint32Incl(comment?: string): () => void;
    expectWriteLength(length: number, indentDelta?: number): readonly [() => void, () => number];
    array(): Uint8Array<ArrayBufferLike>;
    commentedString(all?: boolean): string;
}

export declare class Cert {
    serialNumber: Uint8Array;
    algorithm: OID;
    issuer: DistinguishedName;
    validityPeriod: {
        notBefore: Date;
        notAfter: Date;
    };
    subject: DistinguishedName;
    publicKey: {
        identifiers: OID[];
        data: Uint8Array;
        all: Uint8Array;
    };
    signature: Uint8Array;
    keyUsage?: {
        critical?: boolean;
        usages: Set<typeof allKeyUsages[number]>;
    };
    subjectAltNames?: string[];
    extKeyUsage?: {
        clientTls?: true;
        serverTls?: true;
    };
    authorityKeyIdentifier?: Uint8Array;
    subjectKeyIdentifier?: Uint8Array;
    basicConstraints?: {
        critical?: boolean;
        ca?: boolean;
        pathLength?: number;
    } | undefined;
    signedData: Uint8Array;
    rawData: Uint8Array;
    constructor();
    static distinguishedNamesAreEqual(dn1: DistinguishedName, dn2: DistinguishedName): boolean;
    static stringFromDistinguishedName(dn: DistinguishedName): string;
    static create(certData: Uint8Array | ASN1Bytes | CertJSON): Promise<Cert>;
    subjectAltNameMatchingHost(host: string): string | undefined;
    isValidAtMoment(moment?: Date): boolean;
    description(): string;
    toJSON(): {
        serialNumber: string;
        algorithm: string;
        issuer: DistinguishedName;
        validityPeriod: {
            notBefore: string;
            notAfter: string;
        };
        subject: DistinguishedName;
        publicKey: {
            identifiers: string[];
            data: string;
            all: string;
        };
        signature: string;
        keyUsage: {
            critical: boolean | undefined;
            usages: ("digitalSignature" | "nonRepudiation" | "keyEncipherment" | "dataEncipherment" | "keyAgreement" | "keyCertSign" | "cRLSign" | "encipherOnly" | "decipherOnly")[];
        };
        subjectAltNames: string[] | undefined;
        extKeyUsage: {
            clientTls?: true;
            serverTls?: true;
        } | undefined;
        authorityKeyIdentifier: string | undefined;
        subjectKeyIdentifier: string | undefined;
        basicConstraints: {
            critical?: boolean;
            ca?: boolean;
            pathLength?: number;
        } | undefined;
        signedData: string;
        rawData: string;
    };
    static uint8ArraysFromPEM(pem: string): Uint8Array<ArrayBuffer>[];
    static fromPEM(pem: string): Promise<Cert[]>;
}

export declare type CertJSON = ReturnType<typeof Cert.prototype.toJSON>;

export declare interface DataRequest {
    bytes: number;
    resolve: (data: Uint8Array | undefined) => void;
    readMode: ReadMode;
}

export declare type DistinguishedName = Record<string, string | string[]>;

export declare function hexFromU8(u8: Uint8Array | number[], spacer?: string): string;

export declare function https(urlStr: string, method: string, transportFactory: typeof wsTransport | typeof tcpTransport, { headers, httpVersion, timeout, }?: HTTPSOptions): Promise<string>;

declare interface HTTPSOptions {
    headers?: Record<string, string>;
    httpVersion?: string;
    timeout?: number;
}

export declare class LazyReadFunctionReadQueue extends ReadQueue {
    protected readFn: () => Promise<Uint8Array | undefined>;
    protected dataIsExhausted: boolean;
    constructor(readFn: () => Promise<Uint8Array | undefined>);
    read(bytes: number, readMode?: ReadMode): Promise<Uint8Array<ArrayBufferLike> | undefined>;
    moreDataMayFollow(): boolean;
}

export declare type OID = string;

export declare enum ReadMode {
    CONSUME = 0,
    PEEK = 1
}

export declare abstract class ReadQueue {
    queue: Uint8Array[];
    outstandingRequest: DataRequest | undefined;
    constructor();
    abstract moreDataMayFollow(): boolean;
    enqueue(data: Uint8Array): void;
    dequeue(): void;
    bytesInQueue(): number;
    read(bytes: number, readMode?: ReadMode): Promise<Uint8Array<ArrayBufferLike> | undefined>;
}

export declare type RootCertsData = Uint8Array;

export declare interface RootCertsDatabase {
    index: RootCertsIndex;
    data: RootCertsData;
}

export declare interface RootCertsIndex {
    offsets: number[];
    subjects: Record<string, number>;
}

export declare class SocketReadQueue extends ReadQueue {
    protected socket: Socket;
    constructor(socket: Socket);
    moreDataMayFollow(): boolean;
}

export declare function stableStringify(x: any, replacer?: (key: string, value: any) => any, indent?: string | number): string;

export declare function startTls(host: string, rootCertsDatabase: RootCertsDatabase | string, networkRead: (bytes: number) => Promise<Uint8Array | undefined>, networkWrite: (data: Uint8Array) => void, { useSNI, requireServerTlsExtKeyUsage, requireDigitalSigKeyUsage, writePreData, expectPreData, commentPreData }?: {
    useSNI?: boolean;
    requireServerTlsExtKeyUsage?: boolean;
    requireDigitalSigKeyUsage?: boolean;
    writePreData?: Uint8Array;
    expectPreData?: Uint8Array;
    commentPreData?: string;
}): Promise<{
    readonly read: () => Promise<Uint8Array<ArrayBufferLike> | undefined>;
    readonly write: (data: Uint8Array) => Promise<void>;
    readonly userCert: Cert;
}>;

export declare function tcpTransport(host: string, port: string | number, close?: () => void, timeout?: number): Promise<{
    read: (bytes: number, readMode?: ReadMode) => Promise<Uint8Array<ArrayBufferLike> | undefined>;
    write: {
        (buffer: Uint8Array | string, cb?: (err?: Error) => void): boolean;
        (str: Uint8Array | string, encoding?: BufferEncoding, cb?: (err?: Error) => void): boolean;
    };
    stats: {
        read: number;
        written: number;
    };
}>;

export declare class TLSError extends Error {
    name: string;
    constructor(message: string);
}

export declare class TLSFatalAlertError extends Error {
    alertCode: number;
    name: string;
    constructor(message: string, alertCode: number);
}

export declare class TrustedCert extends Cert {
    static databaseFromPEM(pem: string): Promise<RootCertsDatabase>;
    static findInDatabase(subjectOrSubjectKeyId: DistinguishedName | string, db: RootCertsDatabase): Promise<Cert | undefined>;
}

export declare function u8FromHex(hex: string): Uint8Array<ArrayBuffer>;

export declare class WebSocketReadQueue extends ReadQueue {
    protected socket: WebSocket;
    constructor(socket: WebSocket);
    moreDataMayFollow(): boolean;
}

export declare function wsTransport(host: string, port: string | number, close?: () => void): Promise<{
    read: (bytes: number, readMode?: ReadMode) => Promise<Uint8Array<ArrayBufferLike> | undefined>;
    write: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
    stats: {
        read: number;
        written: number;
    };
}>;


export * from "hextreme";

