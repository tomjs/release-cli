import chalk from 'chalk';
import { NPM_REGISTRY, NPM_YARN_REGISTRY } from './constants.js';
import type { PackageManager } from './manager.js';
import type { NpmInfo, PackageInfo } from './types.js';
import { getScope, isScopedPackage, removeTrailingSlashes, run } from './utils.js';

export const getNpmInfo = async (pkg: PackageInfo) => {
  const cmd = `npm view ${pkg.name} --json --registry=${pkg.registry}`;
  let json: NpmInfo | undefined;
  try {
    console.info(`Get ${chalk.green(pkg.name)} npm info from ${chalk.green(pkg.registry)}`);
    const result = await run(cmd, { spinner: `Fetching...` });
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

export const getNpmTags = async (pkg: PackageInfo) => {
  const cmd = `npm view ${pkg.name} dist-tags --registry=${pkg.registry}`;
  let tags: Record<string, string> = {};
  try {
    console.info(`Get ${chalk.green(pkg.name)} npm tags from ${chalk.green(pkg.registry)}`);
    const result = await run(cmd, { spinner: `Fetching...` });
    tags = JSON.parse(result);
  } catch {}

  return tags;
};

export const getNpmVersion = async (pkg: PackageInfo) => {
  const cmd = `npm view ${pkg.name} version --registry=${pkg.registry}`;
  try {
    console.info(`Get ${chalk.green(pkg.name)} npm version from ${chalk.green(pkg.registry)}`);
    const result = await run(cmd, { spinner: `Fetching...`, trim: true });
    return result;
  } catch {}
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

async function _getNpmRegistry(pm: PackageManager, pkg?: PackageInfo) {
  try {
    const pkgName = pkg?.name;
    let registry = pkg?.packageJson.publishConfig?.registry;
    if (!registry) {
      const cmd =
        pm.id === 'yarn-berry' ? getBerryRegistryCmd(pkgName) : getNpmRegistryCmd(pm, pkgName);

      registry = await run(cmd, {
        trim: true,
        cwd: ['npm', 'yarn'].includes(pm.id) ? undefined : pkg?.dir,
      });

      registry = registry === 'undefined' ? '' : registry;
    }
  } catch {}
  return NPM_REGISTRY;
}

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

export function getPackageNewVersionTag(name: string, version: string, isMonorepo = true) {
  if (isScopedPackage(name) || isMonorepo) {
    return `${name}@${version}`;
  }
  return `v${version}`;
}
