import type { PackageManager, PackageManagerId } from '@tomjs/pkg';
import { getPackageManager } from '@tomjs/pkg';
import chalk from 'chalk';
import semver from 'semver';

export async function getPackageManagerConfig(rootDir: string) {
  const pm: PackageManager = await getPackageManager(rootDir);
  const versions: Record<PackageManagerId, string> = {
    npm: '7.0.0',
    pnpm: '8.0.0',
    yarn: '',
    berry: '3.1.0',
  };
  const minVersion = versions[pm.id];

  if (minVersion && semver.lt(pm.version, minVersion)) {
    throw new Error(
      `Package manager ${chalk.green(pm.id)} version ${chalk.yellow(pm.version)} is not supported, please upgrade to ${chalk.green(minVersion)} or later`,
    );
  }

  return pm;
}
