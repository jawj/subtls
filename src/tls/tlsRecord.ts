import { Crypter } from './aesgcm';
import { Bytes } from '../util/bytes';
import { concat } from '../util/array';
import { parseSessionTicket } from './sessionTicket';
import { LogColours } from '../presentation/appearance';
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
  [RecordType.ChangeCipherSpec]: 'ChangeCipherSpec',
  [RecordType.Alert]: 'Alert',
  [RecordType.Handshake]: 'Handshake',
  [RecordType.Application]: 'Application',
  [RecordType.Heartbeat]: 'Heartbeat',
} as const;

const maxPlaintextRecordLength = 1 << 14;
const maxCiphertextRecordLength = maxPlaintextRecordLength + 1 /* record type */ + 255 /* max aead */;

export async function readTlsRecord(read: (length: number) => Promise<Uint8Array | undefined>, expectedType?: RecordType, maxLength = maxPlaintextRecordLength) {
  const record = new Bytes(read);

  // const headerLength = 5;
  // const headerData = await read(headerLength);
  // if (headerData === undefined) return;
  // if (headerData.length < headerLength) throw new Error('TLS record header truncated');

  // const header = new Bytes(headerData);

  const type = await record.readUint8() as keyof typeof RecordTypeName;
  if (type < 0x14 || type > 0x18) throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);
  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, '0')} (expected 0x${expectedType.toString(16).padStart(2, '0')})`);
  chatty && record.comment(`record type: ${RecordTypeName[type]}`);

  await record.expectUint16(0x0303, 'TLS record version 1.2 (middlebox compatibility)');

  const length = await record.readUint16();
  chatty && record.comment(`${length === 0 ? 'no' : length} byte${length === 1 ? '' : 's'} of TLS record follow${length === 1 ? 's' : ''}`)
  if (length > maxLength) throw new Error(`Record too long: ${length} bytes`)

  chatty && log(...highlightBytes(record.commentedString(), LogColours.server));

  const content = await record.readBytes(length);
  return { type, length, content };
}

export async function readEncryptedTlsRecord(read: (length: number) => Promise<Uint8Array | undefined>, decrypter: Crypter, expectedType?: RecordType): Promise<Uint8Array | undefined> {
  const encryptedRecord = await readTlsRecord(read, RecordType.Application, maxCiphertextRecordLength);
  if (encryptedRecord === undefined) return;

  const encryptedBytes = new Bytes(encryptedRecord.content);
  const [endEncrypted] = encryptedBytes.expectLength(encryptedBytes.readRemaining());
  encryptedBytes.skipRead(encryptedRecord.length - 16, chatty && 'encrypted payload');
  encryptedBytes.skipRead(16, chatty && 'auth tag');
  endEncrypted();
  chatty && log(...highlightBytes(encryptedRecord.header.commentedString() + encryptedBytes.commentedString(), LogColours.server));

  const decryptedRecord = await decrypter.process(encryptedRecord.content, 16, encryptedRecord.headerData);

  // strip zero-padding at end
  let recordTypeIndex = decryptedRecord.length - 1;
  while (decryptedRecord[recordTypeIndex] === 0) recordTypeIndex -= 1;
  if (recordTypeIndex < 0) throw new Error('Decrypted message has no record type indicator (all zeroes)');

  const type = decryptedRecord[recordTypeIndex];
  const record = decryptedRecord.subarray(0, recordTypeIndex /* exclusive */);

  if (type === RecordType.Alert) {
    const closeNotify = record.length === 2 && record[0] === 0x01 && record[1] === 0x00;
    chatty && log(`%cTLS 0x15 alert record: ${hexFromU8(record, ' ')}` + (closeNotify ? ' (close notify)' : ''), `color: ${LogColours.header}`);
    if (closeNotify) return undefined;  // 0x00 is close_notify
  }

  chatty && log(`... decrypted payload (see below) ... %s%c  %s`, type.toString(16).padStart(2, '0'), `color: ${LogColours.server}`, `actual decrypted record type: ${(RecordTypeName as any)[type]}`);

  if (type === RecordType.Handshake && record[0] === 0x04) {  // new session ticket message: always ignore these
    parseSessionTicket(record);
    return readEncryptedTlsRecord(read, decrypter, expectedType);
  }

  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, '0')} (expected 0x${expectedType.toString(16).padStart(2, '0')})`);

  return record;
}

async function makeEncryptedTlsRecord(plaintext: Uint8Array, encrypter: Crypter, type: RecordType) {
  const data = concat(plaintext, [type]);
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

export async function makeEncryptedTlsRecords(plaintext: Uint8Array, encrypter: Crypter, type: RecordType) {
  const recordCount = Math.ceil(plaintext.length / maxPlaintextRecordLength);
  const encryptedRecords = [];
  for (let i = 0; i < recordCount; i++) {
    const data = plaintext.subarray(i * maxPlaintextRecordLength, (i + 1) * maxPlaintextRecordLength);
    const encryptedRecord = await makeEncryptedTlsRecord(data, encrypter, type);
    encryptedRecords.push(encryptedRecord);
  }
  return encryptedRecords;
}
