
export class TLSError extends Error {
  override name = 'TLSError';
  constructor(message: string) {
    super(message);
  }
}

export class TLSFatalAlertError extends Error {
  override name = 'TLSFatalAlertError';
  constructor(message: string, public alertCode: number) {
    super(message);
  }
}
