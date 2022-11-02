import Bytes from './bytes';
import type { ReadQueue } from './readqueue';

export enum RecordTypes {
  ChangeCipherSpec = 0x14,
  Alert = 0x15,
  Handshake = 0x16,
  Application = 0x17,
  Heartbeat = 0x18,
}

export const RecordTypeNames = {
  0x14: '0x14 ChangeCipherSpec',
  0x15: `0x15 Alert`,
  0x16: `0x16 Handshake`,
  0x17: `0x17 Application`,
  0x18: `0x18 Heartbeat`,
};

const maxRecordLength = 1 << 14;

export async function readTlsRecord(reader: ReadQueue, expectedType?: RecordTypes) {
  const headerData = await reader.read(5);
  const header = new Bytes(headerData);

  const type = header.readUint8() as keyof typeof RecordTypeNames;
  if (type < 0x14 || type > 0x18) throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16)} (expected ${expectedType})`);

  const version = header.readUint16();
  if ([0x0301, 0x0302, 0x0303].indexOf(version) < 0) throw new Error(`Unsupported TLS record version 0x${version.toString(16)}`);

  const length = header.readUint16();
  if (length > maxRecordLength) throw new Error(`Record too long: ${length} bytes`)

  const content = await reader.read(length);
  return { type, version, length, content };
}

