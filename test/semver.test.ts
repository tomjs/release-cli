import semver from 'semver';
import { expect, it } from 'vitest';

it(`semver.inc`, () => {
  expect(semver.inc('1.2.3', 'patch')).toBe('1.2.4');
  expect(semver.inc('1.2.3', 'minor')).toBe('1.3.0');
  expect(semver.inc('1.2.3', 'major')).toBe('2.0.0');
  expect(semver.inc('1.2.3', 'prepatch')).toBe('1.2.4-0');
  expect(semver.inc('1.2.3', 'prepatch', 'alpha')).toBe('1.2.4-alpha.0');
  expect(semver.inc('1.2.3', 'prepatch', 'beta')).toBe('1.2.4-beta.0');
  expect(semver.inc('1.2.3', 'preminor')).toBe('1.3.0-0');
  expect(semver.inc('1.2.3', 'premajor')).toBe('2.0.0-0');
  expect(semver.inc('1.2.3', 'prerelease')).toBe('1.2.4-0');

  expect(semver.inc('1.2.3-0', 'prepatch')).toBe('1.2.4-0');
  expect(semver.inc('1.2.3-0', 'preminor')).toBe('1.3.0-0');
  expect(semver.inc('1.2.3-0', 'premajor')).toBe('2.0.0-0');
  expect(semver.inc('1.2.3-0', 'prerelease')).toBe('1.2.3-1');

  expect(semver.inc('1.2.3-alpha.0', 'prerelease', 'alpha')).toBe('1.2.3-alpha.1');
  expect(semver.inc('1.2.3-alpha.0', 'prerelease', 'beta')).toBe('1.2.3-beta.0');
  expect(semver.inc('1.2.3-alpha.0', 'prerelease', 'rc')).toBe('1.2.3-rc.0');
  expect(semver.inc('1.2.3-alpha.1', 'prepatch', 'alpha')).toBe('1.2.4-alpha.0');
  expect(semver.inc('1.2.3-alpha.0', 'preminor', 'alpha')).toBe('1.3.0-alpha.0');
});

it(`semver.diff`, () => {
  expect(semver.diff('1.2.3', '1.2.4')).toBe('patch');
  expect(semver.diff('1.2.3', '1.3.1')).toBe('minor');
  expect(semver.diff('1.2.3', '2.0.1')).toBe('major');
});
