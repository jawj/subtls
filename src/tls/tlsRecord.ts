import { Crypter } from './aesgcm';
import { Bytes } from '../util/bytes';
import { ASN1Bytes } from '../util/asn1bytes';
import { concat } from '../util/array';
import { parseSessionTicket } from './sessionTicket';
import { LogColours } from '../presentation/appearance';
import { highlightBytes } from '../presentation/highlights';
import { appendLog, log } from '../presentation/log';
import { hexFromU8 } from '../util/hex';
import { LazyReadFunctionReadQueue } from '../util/readQueue';
import exp from 'constants';

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

export const AlertRecordLevelName = {
  1: 'warning',
  2: 'fatal',
} as Record<number, string>;

export const AlertRecordDescName = {
  0: 'close_notify',
  10: 'unexpected_message',
  20: 'bad_record_mac',
  22: 'record_overflow',
  40: 'handshake_failure',
  42: 'bad_certificate',
  43: 'unsupported_certificate',
  44: 'certificate_revoked',
  45: 'certificate_expired',
  46: 'certificate_unknown',
  47: 'illegal_parameter',
  48: 'unknown_ca',
  49: 'access_denied',
  50: 'decode_error',
  51: 'decrypt_error',
  70: 'protocol_version',
  71: 'insufficient_security',
  80: 'internal_error',
  86: 'inappropriate_fallback',
  90: 'user_canceled',
  109: 'missing_extension',
  110: 'unsupported_extension',
  112: 'unrecognized_name',
  113: 'bad_certificate_status_response',
  115: 'unknown_psk_identity',
  116: 'certificate_required',
  120: 'no_application_protocol',
} as Record<number, string>;

const maxPlaintextRecordLength = 1 << 14;
const maxCiphertextRecordLength = maxPlaintextRecordLength + 1 /* record type */ + 255 /* max aead */;

export async function readTlsRecord(read: (length: number) => Promise<Uint8Array | undefined>, expectedType?: RecordType, maxLength = maxPlaintextRecordLength) {
  const record = new Bytes(read);

  let type: keyof typeof RecordTypeName
  try {
    type = await record.readUint8();
  } catch (e: any) {
    if (e._bytes_error_reason === 'EOF') return undefined;  // no more data
    throw e;
  }

  chatty && record.comment(`record type: ${RecordTypeName[type]}`);
  if (type < 0x14 || type > 0x18) throw new Error(`Illegal TLS record type 0x${type.toString(16)}`);

  await record.expectUint16(0x0303, 'TLS record version 1.2 (middlebox compatibility)');

  const [, recordRemaining] = await record.expectLengthUint16('TLS record');
  const length = recordRemaining();

  if (length > maxLength) throw new Error(`Record too long: ${length} bytes`);

  let alertLevel;
  if (type === RecordType.Alert) {
    alertLevel = await record.readUint8(chatty && 'alert level:');
    chatty && record.comment(AlertRecordLevelName[alertLevel] ?? 'unknown');

    const desc = await record.readUint8(chatty && 'alert description:');
    chatty && record.comment(AlertRecordDescName[desc] ?? 'unknown');
  }

  chatty && log(...highlightBytes(record.commentedString(), type === RecordType.Alert ? LogColours.header : LogColours.server));

  if (alertLevel === 2) throw new Error('Unexpected fatal alert');
  else if (alertLevel === 1) return readTlsRecord(read, expectedType, maxLength);  // ignore and continue

  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, '0')} (expected 0x${expectedType.toString(16).padStart(2, '0')})`);

  const rawHeader = record.array();
  const content = await record.subarrayForRead(length);

  return { type, length, content, rawHeader };
}

export function bytesFromTlsRecords(read: (length: number) => Promise<Uint8Array | undefined>, expectedType?: RecordType) {
  const readQueue = new LazyReadFunctionReadQueue(async () => {
    const record = await readTlsRecord(read, expectedType);
    return record?.content;
  });
  const bytes = new ASN1Bytes(readQueue.read.bind(readQueue), 1);
  return bytes;
}

export async function readEncryptedTlsRecord(read: (length: number) => Promise<Uint8Array | undefined>, decrypter: Crypter, expectedType?: RecordType): Promise<Uint8Array | undefined> {
  const encryptedRecord = await readTlsRecord(read, RecordType.Application, maxCiphertextRecordLength);
  if (encryptedRecord === undefined) return;

  const encryptedBytes = new Bytes(encryptedRecord.content, 1);
  await encryptedBytes.skipRead(encryptedRecord.length - 16, chatty && 'encrypted payload');
  await encryptedBytes.skipRead(16, chatty && 'auth tag');
  chatty && log(appendLog, ...highlightBytes(encryptedBytes.commentedString(), LogColours.server));

  const decryptedRecord = await decrypter.process(encryptedRecord.content, 16, encryptedRecord.rawHeader);

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
    await parseSessionTicket(record);
    return readEncryptedTlsRecord(read, decrypter, expectedType);
  }

  if (expectedType !== undefined && type !== expectedType) throw new Error(`Unexpected TLS record type 0x${type.toString(16).padStart(2, '0')} (expected 0x${expectedType.toString(16).padStart(2, '0')})`);

  return record;
}

export function bytesFromEncryptedTlsRecords(read: (length: number) => Promise<Uint8Array | undefined>, decrypter: Crypter, expectedType?: RecordType) {
  const readQueue = new LazyReadFunctionReadQueue(async () => {
    const record = await readEncryptedTlsRecord(read, decrypter, expectedType);
    return record;
  });
  const bytes = new ASN1Bytes(readQueue.read.bind(readQueue));
  return bytes;
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

  const [endEncryptedRecord] = encryptedRecord.expectWriteLength(payloadLength);

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
