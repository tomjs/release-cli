import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { NPM_REGISTRY, NPM_YARN_REGISTRY } from './constants.js';
import { logger } from './logger.js';
import type { PackageManager } from './manager.js';
import type { NpmInfo, PackageInfo, ReleaseOptions } from './types.js';
import { getScope, removeTrailingSlashes, run } from './utils.js';

export type TwoFactorState = {
  token: string | null;
  isRequired: Promise<boolean>;
  tryAgain?: boolean;
};

export const getNpmEnv = (pkg?: PackageInfo) => {
  return Object.assign({}, process.env, {
    npm_config_registry: pkg?.registry || NPM_REGISTRY,
  });
};

export const getNpmInfo = async (pkg: PackageInfo) => {
  const cmd = `npm info ${pkg.name} --json --registry=${pkg.registry}`;
  let json: NpmInfo | undefined;
  try {
    console.info(`Get ${chalk.green(pkg.name)} npm info from ${chalk.green(pkg.registry)}`);
    const result = await run(cmd, { spinner: `Fetching ${chalk.green(pkg.name)}` });
    json = JSON.parse(result);
  } catch {}

  return Object.assign(
    {
      versions: [],
      'dist-tags': {},
    },
    json,
  ) as NpmInfo;
};

const getNpmRegistryCmd = (pm: PackageManager, pkgName?: string) => {
  const cmd = `${pm.cli} config get registry`;
  if (!pkgName) {
    return cmd;
  }
  const scope = getScope(pkgName);
  return scope ? `${pm.cli} config get ${scope}:registry` : cmd;
};

const getBerryRegistryCmd = (pkgName?: string) => {
  const cmd = 'yarn config get npmRegistryServer';
  if (!pkgName) {
    return cmd;
  }
  const scope = getScope(pkgName);
  return scope ? `yarn config get npmScopes["${scope}"]:npmRegistryServer` : cmd;
};

const _getNpmRegistry = async (pm: PackageManager, pkg?: PackageInfo) => {
  try {
    const pkgName = pkg?.name;
    let registry = pkg?.packageJson.publishConfig?.registry;
    if (!registry) {
      const cmd = pm.id === 'berry' ? getBerryRegistryCmd(pkgName) : getNpmRegistryCmd(pm, pkgName);

      registry = await run(cmd, {
        trim: true,
        cwd: ['npm', 'yarn'].includes(pm.id) ? undefined : pkg?.dir,
      });

      registry = registry === 'undefined' ? '' : registry;
    }
  } catch {}
  return NPM_REGISTRY;
};

export async function getNpmRegistry(pm: PackageManager, pkg: PackageInfo) {
  let registry = '';
  if (pkg) {
    registry = await _getNpmRegistry(pm, pkg);
    if (!registry) {
      registry = await _getNpmRegistry(pm);
    }
  } else {
    registry = await _getNpmRegistry(pm);
  }

  return getCorrectRegistry(registry);
}

export function getCorrectRegistry(registry?: string) {
  registry = removeTrailingSlashes(registry || '');
  return !registry || registry === NPM_YARN_REGISTRY ? NPM_REGISTRY : registry;
}

export function updatePackageVersion(pkg: PackageInfo) {
  const jsonPath = path.join(pkg.dir, 'package.json');
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  json.version = pkg.newVersion;
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n');
}

async function getTokenIsRequired() {
  try {
    const result = await run('npm profile get --json', {
      env: getNpmEnv(),
    });

    const json = JSON.parse(result);
    if (json.error || !json.tfa || !json.tfa.mode) {
      return false;
    }
    return json.tfa.mode === 'auth-and-writes';
  } catch (e: any) {
    logger.error('Error while checking if token is required', e.message);
    return false;
  }
}

export const getTwoFactorState = (opts: ReleaseOptions): TwoFactorState => {
  const { otp, pkgs } = opts;
  if (otp) {
    return {
      token: otp,
      isRequired: Promise.resolve(true),
    };
  }

  if (pkgs.some(pkg => pkg.registry !== NPM_REGISTRY)) {
    return {
      token: null,
      isRequired: Promise.resolve(false),
    };
  }

  return {
    token: null,
    isRequired: getTokenIsRequired(),
  };
};

// const otpAskLimit = pLimit(1);
const askForOtpCode = async (twoFactorState: TwoFactorState) => {
  if (twoFactorState.token !== null) return twoFactorState.token;
  logger.info('This operation requires a one-time password from your authenticator.');

  const { otp } = await inquirer.prompt([
    {
      type: 'input',
      name: 'otp',
      message: `Enter one-time password${twoFactorState.tryAgain ? ' again' : ''}:`,
      validate: input => (input.length !== 6 ? 'Please enter a valid token' : true),
    },
  ]);
  twoFactorState.token = otp;
  return otp;
};

export const getOtpCode = async (twoFactorState: TwoFactorState) => {
  if (twoFactorState.token) {
    return twoFactorState.token;
  }
  return askForOtpCode(twoFactorState);
};
