import Bytes from './bytes';
import type { ReadQueue } from './readqueue';

export async function readTlsRecord(reader: ReadQueue) {
  const headerData = await reader.read(5);
  const header = new Bytes(headerData);

  const type = header.readUint8() as keyof typeof RecordTypeNames;
  if (type < 0x14 || type > 0x18) throw new Error(`Illegal TLS record type ${type} / 0x${type.toString(16)}`);

  const version = header.readUint16();
  if (version != 0x0303) throw new Error(`Unsupported TLS record version ${version} / 0x${version.toString(16)}`);

  const length = header.readUint16();
  const content = await reader.read(length);

  return { type, content };
}

export const RecordTypeNames = {
  0x14: '0x14 ChangeCipherSpec',
  0x15: `0x15 Alert`,
  0x16: `0x16 Handshake`,
  0x17: `0x17 Application`,
  0x18: `0x18 Heartbeat`,
};