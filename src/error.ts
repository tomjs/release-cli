export enum ReleaseErrorCode {
  EXIT = 0,
  ERROR = 1,
  WARNING = 2,
  ROLLBACK = 3,
}

export class ReleaseError extends Error {
  code: number;

  constructor(message: string, code: number = ReleaseErrorCode.ERROR) {
    super(message);

    this.code = code;
  }

  static assert(condition: boolean, msg: string) {
    if (!condition) {
      throw new ReleaseError(msg, ReleaseErrorCode.ERROR);
    }
  }

  static error(msg: string) {
    throw new ReleaseError(msg, ReleaseErrorCode.ERROR);
  }

  static exit(msg?: string) {
    throw new ReleaseError(msg || '', ReleaseErrorCode.EXIT);
  }

  static warning(msg: string) {
    throw new ReleaseError(msg, ReleaseErrorCode.WARNING);
  }

  static rollback(msg: string) {
    throw new ReleaseError(msg, ReleaseErrorCode.ROLLBACK);
  }
}
