import { Crypter } from './aesgcm';
import { LogColours } from '../presentation/appearance';
import Bytes from '../util/bytes';
import { highlightBytes } from '../presentation/highlights';
import { log } from '../presentation/log';
import { hexFromU8 } from '../util/hex';

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

const maxRecordLength = 1 << 14;  // TODO: fix max length for plain and encrypted records

export async function readTlsRecord(read: (length: number) => Promise<Uint8Array | undefined>, expectedType?: RecordType) {
  const headerLength = 5;
  const headerData = await read(headerLength);
  if (headerData === undefined) return;
  if (headerData.length < headerLength) throw new Error('TLS record header truncated');

  const header = new Bytes(headerData);

  const type = header.readUint8() as keyof typeof RecordTypeName;
  if (type < 0x14 || type > 0x18) throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, '0')} (expected 0x${expectedType.toString(16).padStart(2, '0')})`);
  chatty && header.comment(`record type: ${RecordTypeName[type]}`);

  const version = header.readUint16(chatty && 'TLS version');
  if ([0x0301, 0x0302, 0x0303].indexOf(version) < 0) throw new Error(`Unsupported TLS record version 0x${version.toString(16).padStart(4, '0')}`);

  const length = header.readUint16(chatty && '% bytes of TLS record follow');
  if (length > maxRecordLength) throw new Error(`Record too long: ${length} bytes`)

  const content = await read(length);
  if (content === undefined || content.length < length) throw new Error('TLS record content truncated');

  return { headerData, header, type, version, length, content };
}

export async function readEncryptedTlsRecord(read: (length: number) => Promise<Uint8Array | undefined>, decrypter: Crypter, expectedType?: RecordType) {
  const encryptedRecord = await readTlsRecord(read, RecordType.Application);
  if (encryptedRecord === undefined) return;

  const encryptedBytes = new Bytes(encryptedRecord.content);
  const [endEncrypted] = encryptedBytes.expectLength(encryptedBytes.remaining());
  encryptedBytes.skip(encryptedRecord.length - 16, chatty && 'encrypted payload');
  encryptedBytes.skip(16, chatty && 'auth tag');
  endEncrypted();
  chatty && log(...highlightBytes(encryptedRecord.header.commentedString() + encryptedBytes.commentedString(), LogColours.server));

  const decryptedRecord = await decrypter.process(encryptedRecord.content, 16, encryptedRecord.headerData);

  // strip zero-padding at end
  let recordTypeIndex = decryptedRecord.length - 1;
  while (decryptedRecord[recordTypeIndex] === 0) recordTypeIndex -= 1;
  if (recordTypeIndex < 0) throw new Error('Decrypted message is all has no record type indicator (all zeroes)');

  const type = decryptedRecord[recordTypeIndex];
  const record = decryptedRecord.subarray(0, recordTypeIndex /* exclusive */);

  if (type === 0x15) {
    chatty && log(`%cTLS 0x15 alert record: ${hexFromU8(record, ' ')}`, `color: ${LogColours.header}`);
    if (record.length === 2 && record[0] === 0x01 && record[1] === 0x00) return undefined;  // 0x00 is close_notify
  }

  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, '0')} (expected 0x${expectedType.toString(16).padStart(2, '0')})`);
  chatty && log(`... decrypted payload (see below) ... %s%c  %s`, type.toString(16).padStart(2, '0'), `color: ${LogColours.server}`, `actual decrypted record type: ${(RecordTypeName as any)[type]}`);

  return record;
}

export async function makeEncryptedTlsRecord(data: Uint8Array, encrypter: Crypter) {
  const headerLength = 5;
  const dataLength = data.length;
  const authTagLength = 16;
  const payloadLength = dataLength + authTagLength;

  const encryptedRecord = new Bytes(headerLength + payloadLength);
  encryptedRecord.writeUint8(0x17, chatty && 'record type: Application (middlebox compatibility)');
  encryptedRecord.writeUint16(0x0303, chatty && 'TLS version 1.2 (middlebox compatibility)');
  encryptedRecord.writeUint16(payloadLength, `${payloadLength} bytes follow`);

  const [endEncryptedRecord] = encryptedRecord.expectLength(payloadLength);  // unusual (but still useful) when writing

  const header = encryptedRecord.array();
  const encryptedData = await encrypter.process(data, 16, header);
  encryptedRecord.writeBytes(encryptedData.subarray(0, encryptedData.length - 16));
  chatty && encryptedRecord.comment('encrypted data');
  encryptedRecord.writeBytes(encryptedData.subarray(encryptedData.length - 16));
  chatty && encryptedRecord.comment('auth tag');

  endEncryptedRecord();

  chatty && log(...highlightBytes(encryptedRecord.commentedString(), LogColours.client));
  return encryptedRecord.array();
}
