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
} as const;
