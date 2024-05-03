export enum ReleaseErrorCode {
  ERROR = 0,
  WARNING = 1,
  ROLLBACK = 2,
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

  static warning(msg: string) {
    throw new ReleaseError(msg, ReleaseErrorCode.WARNING);
  }

  static rollback(msg: string) {
    throw new ReleaseError(msg, ReleaseErrorCode.ROLLBACK);
  }
}
