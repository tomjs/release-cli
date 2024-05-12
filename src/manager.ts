import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import semver from 'semver';
import type { PackageJson } from 'type-fest';
import { joinArray, run } from './utils.js';

export type PackageManagerCLI = 'npm' | 'pnpm' | 'yarn';
export type PackageManagerId = 'npm' | 'pnpm' | 'yarn' | 'berry';

export interface PackageManager {
  /**
   * The main CLI, e.g. the `npm` in `npm install`, `npm test`, etc.
   */
  cli: PackageManagerCLI;
  /**
   * How the package manager should be referred to in user-facing messages (since there are two different configs for some, e.g. yarn and berry).
   */
  id: PackageManagerId;
  /**
   * The version of the package manager.
   */
  version?: string;
  /**
   * The minimum version of the package manager required.
   */
  minVersion?: string;
  /**
   * The package manager is not supported.
   */
  isNotSupported?: boolean;
  /**
   * Whether the package manager supports workspace protocol (`workspace:`).
   */
  workspaceProtocol?: boolean;
  /**
   * List of lockfile names expected for this package manager, relative to CWD. e.g. `['package-lock.json', 'npm-shrinkwrap.json']`.
   */
  lockfiles: string[];
}

const configs: Record<PackageManagerId, PackageManager> = {
  npm: {
    cli: 'npm',
    id: 'npm',
    minVersion: '7.0.0',
    lockfiles: ['package-lock.json', 'npm-shrinkwrap.json'],
  },
  pnpm: {
    cli: 'pnpm',
    id: 'pnpm',
    minVersion: '8.0.0',
    lockfiles: ['pnpm-lock.yaml'],
  },
  yarn: {
    cli: 'yarn',
    id: 'yarn',
    lockfiles: ['yarn.lock'],
  },
  berry: {
    cli: 'yarn',
    id: 'berry',
    minVersion: '3.1.0',
    lockfiles: ['yarn.lock'],
  },
};

function configFromPackageManagerField(pkg: PackageJson) {
  if (typeof pkg.packageManager !== 'string') {
    return undefined;
  }

  const [cli, version] = pkg.packageManager.split('@') as [PackageManagerCLI, string];

  if (cli === 'yarn' && version && semver.gte(version, '2.0.0')) {
    return configs['berry'];
  }

  const config = configs[cli];
  if (config) {
    return config;
  }

  throw new Error(`Invalid package manager: ${chalk.green(pkg.packageManager)}`);
}

function findLockfile(rootDirectory: string, config: PackageManager) {
  return config.lockfiles
    .map(filename => path.resolve(rootDirectory || '.', filename))
    .find(filepath => fs.existsSync(filepath));
}

function configFromLockfile(rootDirectory: string) {
  return [configs.npm, configs.pnpm, configs.yarn].find(config =>
    findLockfile(rootDirectory, config),
  );
}

export async function getPackageManagerConfig(rootDirectory: string, pkg: PackageJson) {
  const pm = configFromPackageManagerField(pkg) || configFromLockfile(rootDirectory) || configs.npm;

  if (pm.isNotSupported) {
    const supports = Object.keys(configs)
      .filter(s => !configs[s].isNotSupported)
      .map(s => {
        const pm: PackageManager = configs[s];
        return pm.minVersion ? `${pm.cli}>=${pm.minVersion}` : pm.cli;
      });
    throw new Error(
      `Package manager ${chalk.green(pkg.packageManager)} is not supported. Please use one of the following: ${joinArray(supports)}.`,
    );
  }

  // check version
  let version: string = '';

  try {
    version = await run([pm.cli, '--version']);
    pm.version = version;
  } catch {
    throw new Error(`Package manager ${chalk.green(pm.id)} is not installed`);
  }

  if (!version) {
    throw new Error(
      `Package manager ${chalk.green(pm.id)} has unknown version, please make sure ${chalk.green(pm.id)} has been installed`,
    );
  }
  if (pm.minVersion && semver.lt(version, pm.minVersion)) {
    throw new Error(
      `Package manager ${chalk.green(pm.id)} version ${chalk.yellow(version)} is not supported, please upgrade to ${chalk.green(pm.minVersion)} or later`,
    );
  }

  return pm;
}
