import meow from 'meow';
import type { ReleaseType } from 'semver';
import { runRelease } from './release.js';
import { SEMVER_TYPES } from './version.js';

const cli = meow(
  `
Usage
  $ rc [type] [options]

  Type can be:
    ${SEMVER_TYPES.join(' | ')}

Options
  -h, --help            Display this message
  -v, --version         Display version number
`,
  {
    importMeta: import.meta,
    helpIndent: 0,
    flags: {
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
  const type = input[0] as ReleaseType;
  if (type && !SEMVER_TYPES.includes(type)) {
    console.error(`Invalid release type "${type}"`);
  } else {
    await runRelease(Object.assign({ type }, flags));
  }
}
