import fs from 'node:fs';
import path from 'node:path';
import { getPackages } from '@manypkg/get-packages';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';
import type { ReleaseType } from 'semver';
import semver from 'semver';
import type { PackageJson } from 'type-fest';
import { GIT_REPO_HOSTS, NPM_REGISTRY } from './constants.js';
import { ReleaseError } from './error.js';
import {
  checkBranch,
  checkGitRepo,
  checkWorkStatus,
  getChangedPackageNames,
  getCurrentGitSHA,
  getRepositoryUrl,
  parseGitUrl,
} from './git.js';
import { logger } from './logger.js';
import { getPackageManagerConfig } from './manager.js';
import { getNpmInfo, getNpmRegistry } from './npm.js';
import type { PackageInfo, ReleaseCLIOptions, ReleaseOptions } from './types.js';
import { createSpin, isScopedPackage, joinArray, setOptions } from './utils.js';
import {
  diffColor,
  getPreReleaseId,
  incVersion,
  PRERELEASE_VERSIONS,
  SEMVER_TYPES,
} from './version.js';

export async function getReleaseOptions(options: ReleaseCLIOptions) {
  const opts = Object.assign({}, options) as ReleaseOptions;

  setOptions(options);

  await checkCLIOptions(opts);

  opts.gitSHA = await getCurrentGitSHA();

  await findPackages(opts);

  // check package
  if (opts.strict) {
    await checkPackageLint(opts.pkgs);
  }
  await checkRepositoryUrl(opts);

  await selectPackages(opts);
  await checkPackagePublishConfig(opts);

  // npm info
  {
    const spin = createSpin(`Get npm info from npm registry`);
    const list = await Promise.all(opts.pkgs.map(pkg => getNpmInfo(pkg)));
    spin.stop();
    list.forEach((s, i) => {
      opts.pkgs[i].npmInfo = s;
    });
  }

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
    }
  }

  if (!fs.existsSync(cwd!)) {
    throw new Error(`[${chalk.yellow('--cwd')}] Directory "${chalk.red(cwd)}" does not exist.`);
  }

  if (opts.gitChecks) {
    await checkGitRepo();
    await checkWorkStatus();

    if (!opts.anyBranch) {
      opts.branch = await checkBranch(opts.branch);
    }
  }
}

async function findPackages(opts: ReleaseOptions) {
  const { rootPackage, packages: _packages } = await getPackages(opts.cwd!);
  if (!rootPackage || !_packages || _packages.length == 0) {
    throw new Error('No root package found.');
  }
  // ignore private

  const packages = _packages.filter(s => {
    if (s.packageJson.private) {
      return false;
    }
    const dirname = path.dirname(s.relativeDir);
    return !['example', 'examples'].includes(dirname);
  });

  let isMonorepo = false;
  if (packages.length === 0) {
    if (rootPackage.packageJson.private) {
      throw new Error('Not found any valid package.');
    }
    packages[0] = rootPackage;
  } else {
    isMonorepo = rootPackage.dir !== packages[0].dir;
  }

  opts.isMonorepo = isMonorepo;

  const pm = await getPackageManagerConfig(rootPackage.dir, rootPackage.packageJson as PackageJson);
  opts.packageManager = pm;

  const pkgs = packages
    .filter(s => !s.packageJson.private)
    .map(s => {
      return {
        ...s,
        name: s.packageJson.name,
        version: s.packageJson.version,
        newVersion: '',
        tag: '',
        scoped: isScopedPackage(s.packageJson.name),
      } as PackageInfo;
    });
  opts.pkgs = pkgs;

  // check package name
  {
    const names: Record<string, number> = {};
    for (const pkg of pkgs) {
      names[pkg.name] = (names[pkg.name] || 0) + 1;
    }

    const more = Object.keys(names).filter(name => names[name] > 1);
    if (more.length) {
      throw new Error(`Package name must be unique. ${more.join(', ')}`);
    }
  }
}

async function checkPackagePublishConfig(opts: ReleaseOptions) {
  const { pkgs, packageManager: pm } = opts;

  for (const pkg of pkgs) {
    const { name } = pkg;
    const registry = await getNpmRegistry(pm, pkg);
    pkg.registry = registry;

    const pc = pkg.packageJson.publishConfig || {};
    if (registry !== NPM_REGISTRY && pc.access !== 'restricted') {
      throw new Error(
        `${chalk.blue(name)} publish registry URL is ${chalk.red(registry)}, but access is not ${chalk.green('restricted')}`,
      );
    }

    pkg.access = registry === NPM_REGISTRY ? 'public' : 'restricted';
  }
}

async function checkRepositoryUrl(opts: ReleaseOptions) {
  if (!opts.log) {
    return;
  }

  const { pkgs } = opts;
  let repoUrl = opts.gitUrl;
  if (!repoUrl) {
    for (const pkg of pkgs) {
      const repo = pkg.packageJson.repository;
      if (repo && !repoUrl) {
        repoUrl = typeof repo === 'object' ? repo.url : repo;
        if (repoUrl) break;
      }
    }
  }

  if (!repoUrl) {
    repoUrl = await getRepositoryUrl();
  }

  function invalid(warn: string) {
    opts.logCommit = false;
    opts.logCompare = false;

    warn && logger.warning(warn);
  }

  if (!repoUrl) {
    return invalid(
      pkgs.length === 1
        ? `This package has no repository url.`
        : `All selected packages have no repository url.`,
    );
  }

  const gitUrl: URL = parseGitUrl(repoUrl);
  const protocols = ['git+ssh:', 'ssh:', 'git+http:', 'http:', 'git+https:', 'https:', 'git:'];
  if (!protocols.includes(gitUrl.protocol)) {
    return invalid(`${chalk.red(repoUrl)} is not a valid git url.`);
  }

  const supported = GIT_REPO_HOSTS.includes(gitUrl.host);
  opts.logCommit ??= supported;
  opts.logCompare ??= supported;
  opts.releaseDraft ??= supported;

  const protocol = gitUrl.protocol.includes('http:') ? 'http:' : 'https:';
  const webUrl =
    protocol + '//' + gitUrl.host + gitUrl.pathname.replace(/.git$/, '').replace(/\/$/, '');

  opts.gitUrl = webUrl;

  logger.info(`Get git repository url: ${chalk.blue(webUrl)}`);

  if (opts.logCommit) {
    const link = opts.gitCommitUrl || '{url}/commit/{sha}';
    opts.gitCommitUrl = link.replace(/{url}/g, webUrl);
  }
  if (opts.logCompare) {
    const link = opts.gitCompareUrl || '{url}/compare/{diff}';
    opts.gitCompareUrl = link.replace(/{url}/g, webUrl);
  }
}

async function checkPackageLint(pkgs: PackageInfo[]) {
  let count = 0;
  const log = (msg: string) => {
    count++;
    logger.error(msg);
  };

  for (const pkg of pkgs) {
    const p = pkg.packageJson;
    if (!p.version) {
      log(`${chalk.yellow(pkg.name)} has no version`);
    }
    const { messages } = await publint({ pkgDir: pkg.dir });
    if (messages.length) {
      log(`${chalk.yellow(pkg.name)} has ${chalk.red(messages.length)} lint error`);
      for (let i = 0; i < messages.length; i++) {
        log(`  ${i + 1}.` + formatMessage(messages[i], p) || 'unknown error');
      }
    }
  }

  if (count > 0) {
    ReleaseError.exit();
  }
}

async function selectPackages(opts: ReleaseOptions) {
  let pkgs = opts.pkgs;

  const changed = await getChangedPackageNames(opts);
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
          name: changed.includes(name) ? chalk.yellow(name) : name,
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
    throw new Error(`${chalk.blue(name)}'s version is invalid: ${chalk.red(version)}`);
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

  const tags = pkg.npmInfo['dist-tags'] || {};
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
      message: `${version} is a pre-release version. Select a tag for ${chalk.blue(name)}`,
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
      message: `Input custom tag for ${chalk.blue(name)}`,
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
