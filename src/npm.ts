import type { PackageManager } from '@tomjs/pkg';
import type { NpmInfo, PackageInfo, ReleaseOptions } from './types';
import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { NPM_REGISTRY, NPM_YARN_REGISTRY } from './constants';
import { logger } from './logger';
import { getScope, removeTrailingSlashes, run } from './utils';

export interface TwoFactorState {
  token: string | null;
  isRequired: Promise<boolean>;
  tryAgain?: boolean;
}

export function getNpmEnv(pkg?: PackageInfo) {
  return Object.assign({}, process.env, {
    npm_config_registry: pkg?.registry || NPM_REGISTRY,
  });
}

export async function getNpmInfo(pkg: PackageInfo) {
  const cmd = `npm info ${pkg.name} --json --registry=${pkg.registry}`;
  let json: NpmInfo | undefined;
  try {
    const result = await run(cmd);
    json = JSON.parse(result);
  }
  catch {}

  return Object.assign(
    {
      'versions': [],
      'dist-tags': {},
    },
    json,
  ) as NpmInfo;
}

function getNpmRegistryCmd(pm: PackageManager, pkgName?: string) {
  const cmd = `${pm.cli} config get registry`;
  if (!pkgName) {
    return cmd;
  }
  const scope = getScope(pkgName);
  return scope ? `${pm.cli} config get ${scope}:registry` : cmd;
}

function getBerryRegistryCmd(pkgName?: string) {
  const cmd = 'yarn config get npmRegistryServer';
  if (!pkgName) {
    return cmd;
  }
  const scope = getScope(pkgName);
  return scope ? `yarn config get npmScopes["${scope}"]:npmRegistryServer` : cmd;
}

async function _getNpmRegistry(pm: PackageManager, pkg?: PackageInfo) {
  try {
    const pkgName = pkg?.name;
    let registry = pkg?.packageJson.publishConfig?.registry;
    if (registry) {
      return removeTrailingSlashes(registry);
    }

    const cmd = pm.id === 'berry' ? getBerryRegistryCmd(pkgName) : getNpmRegistryCmd(pm, pkgName);

    registry = await run(cmd, {
      trim: true,
      cwd: ['npm', 'yarn'].includes(pm.id) ? undefined : pkg?.dir,
    });

    registry = registry === 'undefined' ? '' : registry;

    return removeTrailingSlashes(registry) || NPM_REGISTRY;
  }
  catch {}

  return NPM_REGISTRY;
}

export async function getNpmRegistry(pm: PackageManager, pkg: PackageInfo) {
  let registry = '';
  if (pkg) {
    registry = await _getNpmRegistry(pm, pkg);
    if (!registry) {
      registry = await _getNpmRegistry(pm);
    }
  }
  else {
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
  fs.writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
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
  }
  catch (e: any) {
    logger.error('Error while checking if token is required', e.message);
    return false;
  }
}

export function getTwoFactorState(opts: ReleaseOptions): TwoFactorState {
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
}

// const otpAskLimit = pLimit(1);
async function askForOtpCode(twoFactorState: TwoFactorState) {
  if (twoFactorState.token !== null)
    return twoFactorState.token;
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
}

export async function getOtpCode(twoFactorState: TwoFactorState) {
  if (twoFactorState.token) {
    return twoFactorState.token;
  }
  return askForOtpCode(twoFactorState);
}
