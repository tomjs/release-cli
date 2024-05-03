import meow from 'meow';
import type { ReleaseType } from 'semver';
import { isDev } from './constants.js';
import { logger } from './logger.js';
import { runRelease } from './release.js';
import { joinArray } from './utils.js';
import { PRERELEASE_VERSIONS, SEMVER_TYPES } from './version.js';

const cli = meow(
  `
Usage
  $ rc [type] [options]

  Type can be:
    ${SEMVER_TYPES.join(' | ')}

Options
  --cwd <cwd>           The current working directory (default: ".")
  --preid               Specify the pre-release identifier, allowed values are ${joinArray(PRERELEASE_VERSIONS)}.
                        If type is "prerelease", "prepatch", "preminor", "premajor",
                        the preid will be used as the pre-release identifier (default: "alpha").
                        If type is "patch", "minor", "major", the preid will be ignored.
  --tag <tag>           Publish under a given dist-tag (default: "latest")
  --verbose             Display verbose output
  -h, --help            Display this message
  -v, --version         Display version number
`,
  {
    importMeta: import.meta,
    helpIndent: 0,
    flags: {
      cwd: {
        type: 'string',
        default: process.env.RC_CWD || '.',
      },
      preid: {
        type: 'string',
      },
      tag: {
        type: 'string',
      },
      verbose: {
        type: 'boolean',
        default: isDev,
      },
      h: {
        type: 'boolean',
      },
      v: {
        type: 'boolean',
      },
    },
  },
);

const { input, flags } = cli;
if (flags.h) {
  cli.showHelp();
} else if (flags.v) {
  cli.showVersion();
} else {
  logger.setDebug(flags.verbose);

  const type = input[0] as ReleaseType;
  await runRelease(Object.assign({ type }, flags));
}
