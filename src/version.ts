import type { ReleaseType } from 'semver';

export const SEMVER_TYPES: ReleaseType[] = [
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
  'prerelease',
];
