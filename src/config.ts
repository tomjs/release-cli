import type { ReleaseCLIOptions } from './types';
import fs from 'node:fs';
import { cosmiconfig } from 'cosmiconfig';

export async function getReleaseConfig(opts: ReleaseCLIOptions) {
  const explorer = cosmiconfig('rc', {
    stopDir: opts.cwd,
    searchPlaces: [
      'package.json',
      'rc.config.json',
      'rc.config.js',
      'rc.config.mjs',
      'rc.config.cjs',
    ],
  });

  if (opts.config) {
    if (!fs.existsSync(opts.config)) {
      return {};
    }

    const result = await explorer.load(opts.config);
    return result?.config || {};
  }

  const result = await explorer.search();
  return result?.config || {};
}
