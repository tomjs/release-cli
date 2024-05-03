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
    if (e.code === ReleaseErrorCode.WARNING) {
      logger.warning(e.message);
    } else {
      logger.error(e.message);
    }

    if (options.verbose) {
      console.log(e);
    }
  }
}
