import meow from 'meow';
import type { ReleaseType } from 'semver';
import { runGenerateChangelog } from './changelog.js';
import { getReleaseConfig } from './config.js';
import { isDev } from './constants.js';
import { ReleaseErrorCode } from './error.js';
import { resetGitSubmit } from './git.js';
import { logger } from './logger.js';
import { getReleaseOptions } from './options.js';
import { runPublish } from './publish.js';
import type { ReleaseCLIOptions } from './types.js';
import { getOptions, joinArray } from './utils.js';
import { PRERELEASE_VERSIONS, SEMVER_TYPES } from './version.js';

const cli = meow(
  `
Usage
  $ rc [type] [options]

  Type can be:
    ${SEMVER_TYPES.join(' | ')}

Options
  --cwd                 The current working directory (default: ".")
  --config              Specify the config file path (eg. rc.config.json)
  --preid               Specify the pre-release identifier, allowed values are ${joinArray(PRERELEASE_VERSIONS)}.
                        If type is "prerelease", "prepatch", "preminor", "premajor",
                        the preid will be used as the pre-release identifier (default: "alpha").
                        If type is "patch", "minor", "major", the preid will be ignored.
  --no-git-check        Skips checking git status
  --any-branch          Allow publishing from any branch (default: false)
  --branch              Name of the release branch (default: main | master)
  --tag <tag>           Publish under a given dist-tag (default: "latest")
  --no-scoped-tag       Don't Use scoped package name as git tag
  --no-log              Skips generating changelog
  --log-full            Generate a full changelog and replace the existing content (default: false)
  --no-log-commit       Don't add git commit SHA and link to the changelog
  --no-log-compare      Don't add git compare link to the changelog
  --git-url             Specify the git web url. If not specified, the configuration of git or package.json will be read,
                        such as "https://github.com/tomjs/release-cli"
  --git-commit-url      Git commit url template, default: "{url}/commit/{sha}"
  --git-compare-url     Git compare url template, default: "{url}/compare/{diff}"
  --strict              Strict mode, will make some checks more strict (default: false)
  --no-publish          Skips publishing
  --no-build            Skips run build script before publishing
  --no-tag-merge        When publishing multiple packages, each package has its own independent tag and commit
  --otp                 This is a one-time password from a two-factor authenticator
  --no-release-draft    Skips opening a GitHub release draft
  --dry-run             Don't actually release, just simulate the process
  --verbose             Display verbose output
  -h, --help            Display this message
  -v, --version         Display version number
`,
  {
    importMeta: import.meta,
    booleanDefault: undefined,
    helpIndent: 0,
    flags: {
      cwd: {
        type: 'string',
      },
      config: {
        type: 'string',
      },
      gitChecks: {
        type: 'boolean',
        // default: true,
      },
      anyBranch: {
        type: 'boolean',
      },
      branch: {
        type: 'string',
      },
      preid: {
        type: 'string',
      },
      tag: {
        type: 'string',
      },
      scopedTag: {
        type: 'boolean',
        // default: true,
      },
      log: {
        type: 'boolean',
        // default: true,
      },
      logFull: {
        type: 'boolean',
      },
      logCommit: {
        type: 'boolean',
      },
      logCompare: {
        type: 'boolean',
      },
      gitUrl: {
        type: 'string',
      },
      gitCommitUrl: {
        type: 'string',
      },
      gitCompareUrl: {
        type: 'string',
      },
      publish: {
        type: 'boolean',
        // default: true,
      },
      build: {
        type: 'boolean',
        // default: true,
      },
      tagMerge: {
        type: 'boolean',
        // default: true,
      },
      releaseDraft: {
        type: 'boolean',
      },
      otp: {
        type: 'string',
      },
      dryRun: {
        type: 'boolean',
      },
      strict: {
        type: 'boolean',
      },
      verbose: {
        type: 'boolean',
        // default: isDev,
      },
      h: {
        type: 'boolean',
        default: false,
      },
      v: {
        type: 'boolean',
        default: false,
      },
    },
  },
);

const { input, flags } = cli;
if (flags.h) {
  cli.showHelp(0);
} else if (flags.v) {
  cli.showVersion();
} else {
  logger._setDebug(flags.verbose);

  const CWD = process.cwd();
  const type = input[0] as ReleaseType;
  const cliOpts = Object.assign({ type, cwd: CWD }, flags);
  logger.debug('cli options:', cliOpts);

  const config = await getReleaseConfig(cliOpts);
  logger.debug('config file:', config);

  const releaseOpts = Object.assign(
    {
      gitChecks: true,
      scopedTag: true,
      log: true,
      publish: true,
      build: true,
      tagMerge: true,
      verbose: isDev,
    } as ReleaseCLIOptions,
    config,
    cliOpts,
  ) as ReleaseCLIOptions;
  logger.debug('merged options:', releaseOpts);

  releaseOpts.cwd ||= CWD;

  try {
    const opts = await getReleaseOptions(releaseOpts);
    logger.debug(opts);
    await runGenerateChangelog(opts);
    logger.debug(opts);
    await runPublish(opts);
  } catch (e: any) {
    const msg = e?.message;
    if (msg) {
      if (e.code === ReleaseErrorCode.WARNING || e.code === ReleaseErrorCode.EXIT) {
        logger.warning(msg);
      } else {
        logger.error(msg);
      }
    }

    await resetGitSubmit(getOptions() as any);

    if (cliOpts.verbose) {
      console.log();
      console.log();
      console.log(e);
    }
  }
}
