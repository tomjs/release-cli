import fs from 'node:fs';
import { getPackages } from '@manypkg/get-packages';
import chalk from 'chalk';
import inquirer from 'inquirer';
import type { ReleaseType } from 'semver';
import semver from 'semver';
import { ReleaseError } from './error.js';
import { logger } from './logger.js';
import { getNpmTags } from './npm.js';
import type { PackageInfo, ReleaseCLIOptions, ReleaseOptions } from './types.js';
import { joinArray, setOptions } from './utils.js';
import {
  diffColor,
  getPreReleaseId,
  incVersion,
  PRERELEASE_VERSIONS,
  SEMVER_TYPES,
} from './version.js';

export async function getOptions(options: ReleaseCLIOptions) {
  const opts = Object.assign({}, options) as ReleaseOptions;

  await checkCLIOptions(opts);

  setOptions(opts);

  await findPackages(opts);

  await selectPackages(opts);
  await selectTypeVersion(opts);
  await selectVersion(opts);

  return opts;
}

async function checkCLIOptions(opts: ReleaseCLIOptions) {
  const { type, preid, cwd } = opts;

  if (type) {
    if (!SEMVER_TYPES.includes(type as ReleaseType)) {
      throw new Error(
        `[${chalk.yellow('type')}] Invalid release type "${chalk.red(type)}". Valid types are: ${joinArray(SEMVER_TYPES)}.`,
      );
    }

    if (preid !== undefined) {
      if (!PRERELEASE_VERSIONS.includes(preid)) {
        throw new Error(
          `[${chalk.yellow('--preid')}] Invalid pre-release identifier "${chalk.red(preid)}". Valid identifiers are: ${joinArray(PRERELEASE_VERSIONS)}.`,
        );
      }
    } else if (type.startsWith('pre')) {
      opts.preid = 'alpha';
    }
  }

  if (!fs.existsSync(cwd)) {
    throw new Error(`[${chalk.yellow('--cwd')}] Directory "${chalk.red(cwd)}" does not exist.`);
  }
}

async function findPackages(opts: ReleaseOptions) {
  const { rootPackage, packages } = await getPackages(opts.cwd);
  if (!rootPackage || !packages || packages.length == 0) {
    throw new Error('No root package found.');
  }

  const isSingle = packages.length === 1 && rootPackage.dir === packages[0].dir;
  const isMonorepo = packages.length >= 1 && rootPackage.dir !== packages[0].dir;

  if (!isSingle && !isMonorepo) {
    throw new Error('Not a single package or a monorepo.');
  }

  opts.pkgs = packages
    .filter(s => !s.packageJson.private)
    .map(s => {
      return {
        ...s,
        name: s.packageJson.name,
        version: s.packageJson.version,
        newVersion: '',
        tag: '',
      } as PackageInfo;
    });
}

async function selectPackages(opts: ReleaseOptions) {
  let pkgs = opts.pkgs;

  let selected: string[] = [];
  if (pkgs.length === 1) {
    selected = [pkgs[0].name];
  } else {
    const answers = await inquirer.prompt([
      {
        name: 'selected',
        type: 'checkbox',
        message: 'Which packages would you like to be released?',
        validate: (input: string) => input.length > 0 || 'You must choose at least one package!',
        default: [],
        choices: pkgs.map(({ name }) => ({
          name: name,
          value: name,
        })),
      },
    ]);
    selected = answers.selected;
  }

  pkgs = pkgs.filter(pkg => selected.includes(pkg.name));
  opts.pkgs = pkgs;
}

async function selectTypeVersion(opts: ReleaseOptions) {
  const { type, pkgs } = opts;

  if (!type) {
    return;
  }

  pkgs.forEach(s => {
    s.newVersion = incVersion(s.version, type, opts.preid);
  });

  for (const pkg of pkgs) {
    await selectNpmTag(pkg, opts);
  }

  logger.info(
    `New versions:\n${pkgs.map(s => ` - ${s.name}: ${diffColor(s.version, s.newVersion)} (${s.tag})`).join('\n')}`,
  );

  const answers = await inquirer.prompt({
    confirm: {
      type: 'confirm',
      message: `Confirm to release ${pkgs.length > 1 ? 'these packages' : 'the package'} with ${chalk.cyan(type)} version?`,
    },
  });

  if (!answers.confirm) {
    ReleaseError.warning(`Cancel the release.`);
  }
}

async function selectVersion(opts: ReleaseOptions) {
  const { type, pkgs } = opts;

  if (type) {
    return;
  }

  for (const pkg of pkgs) {
    const choices = getVersionChoices(pkg, opts);
    const { version } = await inquirer.prompt({
      version: {
        type: 'list',
        message: `Select a new version for ${chalk.green(`${pkg.name}@${pkg.version}`)}`,
        pageSize: Math.min(choices.length, 10),
        choices,
      },
    });
    pkg.newVersion = version;

    await selectNpmTag(pkg, opts);
  }

  logger.info(
    `New versions:\n${pkgs.map(s => ` - ${s.name}: ${diffColor(s.version, s.newVersion)} (${s.tag})`).join('\n')}`,
  );
}

function getVersionChoices(pkg: PackageInfo, opts: ReleaseOptions) {
  const { name, version } = pkg;
  if (!semver.valid(version)) {
    ReleaseError.error(`${chalk.cyan(name)}'s version is invalid: ${chalk.red(version)}`);
  }

  const preId = getPreReleaseId(version);
  const isStable = preId === undefined;

  const inc = (type: ReleaseType, preId?: string) => incVersion(version, type, preId);

  const choices: { name: string; value: string; disabled?: boolean }[] = [];

  let preIds: string[] = [];
  let types: ReleaseType[] = [];
  if (isStable) {
    const opi = PRERELEASE_VERSIONS.indexOf(opts.preid ?? 'alpha');
    preIds = PRERELEASE_VERSIONS.slice(opi);
    types = ['minor', 'major', 'preminor', 'premajor'];

    choices.push({
      name: `patch`,
      value: inc('patch'),
    });
  } else {
    types = ['prepatch', 'patch', 'minor', 'major'];
    const pi = PRERELEASE_VERSIONS.indexOf(preId);
    if (pi === -1) {
      preIds = [preId];
    } else {
      const start = pi + 1;
      if (start <= PRERELEASE_VERSIONS.length) {
        preIds = PRERELEASE_VERSIONS.slice(start);
      }
    }

    choices.push({
      name: `prerelease (${preId || 'pre'})`,
      value: inc('prerelease'),
    });
  }

  types.forEach(type => {
    if (type.startsWith('pre')) {
      preIds.forEach(preId => {
        const v = inc(type, preId);
        choices.push({
          name: `${type} (${preId})`,
          value: v,
        });
      });
    } else {
      choices.push({
        name: `${type}`,
        value: inc(type),
      });
    }
  });

  let maxLen = 0;
  choices.forEach(c => {
    maxLen = Math.max(maxLen, c.name.length);
  });

  choices.forEach(c => {
    c.name = `${c.name.padEnd(maxLen + 3)} ${diffColor(version, c.value)}`;
  });

  return choices;
}

async function selectNpmTag(pkg: PackageInfo, opts: ReleaseOptions) {
  const { name, newVersion: version } = pkg;
  let preId = getPreReleaseId(version);
  if (opts.tag) {
    pkg.tag = opts.tag;
    return;
  } else if (preId === undefined) {
    pkg.tag = 'latest';
    return;
  }

  const tags = await getNpmTags(name);
  let tagKeys = [...new Set(Object.keys(tags).concat(['alpha', 'beta', 'rc', 'next']))];
  if (preId === '') {
    const pre = ['pre', 'previous'].find(s => tagKeys.includes(s));
    if (pre) {
      preId = pre;
    } else {
      tagKeys.push('pre');
      tagKeys = [...new Set(tagKeys)];
    }
  }
  tagKeys.sort();

  const tagAnswers = await inquirer.prompt({
    tag: {
      type: 'list',
      message: `${version} is a pre-release version. Select a tag for ${chalk.green(name)}`,
      pageSize: Math.min(tagKeys.length + 2, 10),
      default: tagKeys.find(s => s === preId),
      choices() {
        return [
          ...tagKeys.map(tag => {
            let v = tags[tag];
            v = v ? ` (${v})` : '';
            return {
              name: tag + v,
              value: tag,
            };
          }),
          new inquirer.Separator(),
          {
            name: 'Other (specify)',
            value: undefined,
          },
        ];
      },
    },
    customTag: {
      type: 'input',
      message: `Input custom tag for ${chalk.green(name)}`,
      when: answers => answers.tag === undefined,
      validate(input) {
        if (input.length === 0) {
          return 'Please specify a tag, for example, `next`.';
        }

        if (input.toLowerCase() === 'latest') {
          return "It's not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`.";
        }

        return true;
      },
    },
  });

  pkg.tag = tagAnswers.tag || tagAnswers.customTag;
}
