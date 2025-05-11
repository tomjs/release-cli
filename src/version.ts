import type { ChalkInstance } from 'chalk';
import type { ReleaseType, SemVer } from 'semver';
import chalk from 'chalk';
import semver from 'semver';

export const SEMVER_PRE_RELEASE_TYPES: ReleaseType[] = [
  'prepatch',
  'preminor',
  'premajor',
  'prerelease',
];

export const SEMVER_RELEASE_TYPES: ReleaseType[] = ['patch', 'minor', 'major'];

export const SEMVER_TYPES: ReleaseType[] = [...SEMVER_RELEASE_TYPES, ...SEMVER_PRE_RELEASE_TYPES];

export const PRERELEASE_VERSIONS = ['', 'alpha', 'beta', 'rc'];

export function incVersion(
  version: string,
  releaseType: ReleaseType,
  preReleaseId?: string,
): string {
  if (!SEMVER_TYPES.includes(releaseType)) {
    throw new Error(`Invalid release type: ${releaseType}`);
  }
  return semver.inc(version, releaseType, preReleaseId) as string;
}

export function diffColor(first: string, second: string, color?: ChalkInstance) {
  const v1 = semver.parse(first);
  const v2 = semver.parse(second);
  if (v1 === null) {
    throw new Error(`Invalid version: "${first}"`);
  }
  if (v2 === null) {
    throw new Error(`Invalid version: "${second}"`);
  }

  const type = semver.diff(first, second)!;
  const cf = color || chalk.green;

  function format(v: any, match: boolean) {
    return match ? cf(v) : v;
  }

  let version = '';

  {
    const versions: string[] = [];
    versions.push(format(v2.major, ['major', 'premajor'].includes(type)));
    versions.push(format(v2.minor, ['minor', 'preminor'].includes(type)));
    versions.push(format(v2.patch, ['patch', 'prepatch'].includes(type)));
    version = versions.join('.');
  }

  if (Array.isArray(v2.prerelease) && v2.prerelease.length > 0) {
    const getStr = (v: SemVer) => (v.prerelease.length > 0 ? `-${v.prerelease.join('.')}` : '');
    version += diffString(getStr(v1), getStr(v2), cf);
  }

  return version;
}

export function diffString(first: string, second: string, color?: ChalkInstance) {
  if (second.length > first.length) {
    first = first.padEnd(second.length - first.length, '0');
  }

  const cf = color || chalk.cyan;
  return second
    .split('')
    .map((char, index) => {
      if (char !== first[index]) {
        return cf(char);
      }
      return char;
    })
    .join('');
}

export function getPreReleaseId(version: string | SemVer): string | undefined {
  const tags = typeof version === 'string' ? semver.prerelease(version) : version.prerelease;
  if (tags == null || tags.length === 0) {
    return undefined;
  }
  if (tags.length === 1) {
    return '';
  }

  return tags[0] as string;
}
