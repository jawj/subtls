import { Crypter } from '../aesgcm';
import { Colours } from '../colours';
import Bytes from './bytes';
import highlightCommented from './highlightCommented';
import type { ReadQueue } from './readqueue';

export enum RecordType {
  ChangeCipherSpec = 0x14,
  Alert = 0x15,
  Handshake = 0x16,
  Application = 0x17,
  Heartbeat = 0x18,
}

export const RecordTypeName = {
  0x14: 'ChangeCipherSpec',
  0x15: 'Alert',
  0x16: 'Handshake',
  0x17: 'Application',
  0x18: 'Heartbeat',
};

const maxRecordLength = 1 << 14;

export async function readTlsRecord(reader: ReadQueue, expectedType?: RecordType) {
  const headerData = await reader.read(5);
  const header = new Bytes(headerData);

  const type = header.readUint8() as keyof typeof RecordTypeName;
  if (type < 0x14 || type > 0x18) throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, '0')} (expected 0x${expectedType.toString(16).padStart(2, '0')})`);
  header.comment(`record type: ${RecordTypeName[type]}`);

  const version = header.readUint16('TLS version');
  if ([0x0301, 0x0302, 0x0303].indexOf(version) < 0) throw new Error(`Unsupported TLS record version 0x${version.toString(16).padStart(4, '0')}`);

  const length = header.readUint16('% bytes follow');
  if (length > maxRecordLength) throw new Error(`Record too long: ${length} bytes`)

  const content = await reader.read(length);
  return { headerData, header, type, version, length, content };
}

export async function readEncryptedTlsRecord(reader: ReadQueue, decrypter: Crypter, expectedType?: RecordType) {
  const encryptedRecord = await readTlsRecord(reader, RecordType.Application);

  const encryptedBytes = new Bytes(encryptedRecord.content);
  encryptedBytes.skip(encryptedRecord.length - 16, 'encrypted payload');
  encryptedBytes.skip(16, 'auth tag');
  if (encryptedBytes.remainingBytes() !== 0) throw new Error('Unexpected extra bytes at end of encrypted record');
  console.log(...highlightCommented(encryptedRecord.header.commentedString() + encryptedBytes.commentedString(), Colours.server));

  const decryptedRecord = await decrypter.process(encryptedRecord.content, 16, encryptedRecord.headerData);

  const lastByteIndex = decryptedRecord.length - 1;
  const record = decryptedRecord.subarray(0, lastByteIndex /* exclusive */);
  const type = decryptedRecord[lastByteIndex];
  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, '0')} (expected 0x${expectedType.toString(16).padStart(2, '0')})`);
  console.log(`... decrypted payload (see below) ... %s%c  %s`, type.toString(16).padStart(2, '0'), `color: ${Colours.server}`, `actual decrypted record type: ${(RecordTypeName as any)[type]}`);

  return record;
}

export async function makeEncryptedTlsRecord(data: Uint8Array, encrypter: Crypter) {
  const headerLength = 5;
  const dataLength = data.length;
  const authTagLength = 16;
  const payloadLength = dataLength + authTagLength;

  const encryptedRecord = new Bytes(headerLength + payloadLength);
  encryptedRecord.writeUint8(0x17, 'record type: Application (middlebox compatibility)');
  encryptedRecord.writeUint16(0x0303, 'TLS version 1.2 (middlebox compatibility)');
  encryptedRecord.writeUint16(payloadLength, `${payloadLength} bytes follow`);

  const header = encryptedRecord.array();
  const encryptedData = await encrypter.process(data, 16, header);
  encryptedRecord.writeBytes(encryptedData.subarray(0, encryptedData.length - 16));
  encryptedRecord.comment('encrypted data');
  encryptedRecord.writeBytes(encryptedData.subarray(encryptedData.length - 16));
  encryptedRecord.comment('auth tag');

  console.log(...highlightCommented(encryptedRecord.commentedString(), Colours.client));
  return encryptedRecord.array();
}
