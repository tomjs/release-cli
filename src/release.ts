import { ReleaseErrorCode } from './error.js';
import { logger } from './logger.js';
import { getOptions } from './options.js';
import type { ReleaseCLIOptions } from './types.js';

export async function runRelease(options: ReleaseCLIOptions) {
  logger.debug('options:', options);
  try {
    const opts = await getOptions(options);
    console.log(opts);
  } catch (e: any) {
    const msg = e?.message;
    if (msg) {
      if (e.code === ReleaseErrorCode.WARNING || e.code === ReleaseErrorCode.EXIT) {
        logger.warning(msg);
      } else {
        logger.error(msg);
      }
    }

    if (options.verbose) {
      console.log();
      console.log();
      console.log(e);
    }
  }
}
