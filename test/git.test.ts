import { expect, it } from 'vitest';
import { clearTagVersion } from '../src/git';

it('git clearTagVersion', async () => {
  expect(clearTagVersion('v1.2.3')).toBe('1.2.3');
  expect(clearTagVersion('v1.2.3-alpha.1')).toBe('1.2.3-alpha.1');

  expect(clearTagVersion('@tomjs/node@1.2.3-alpha.1')).toBe('1.2.3-alpha.1');
  expect(clearTagVersion('@tomjs/node@1.2.3')).toBe('1.2.3');

  expect(clearTagVersion('node@1.2.3-alpha.1')).toBe('1.2.3-alpha.1');
  expect(clearTagVersion('node@1.2.3')).toBe('1.2.3');

  expect(clearTagVersion('tomjs-release-cli-v1.2.3-alpha.1')).toBe('1.2.3-alpha.1');
  expect(clearTagVersion('tomjs-release-cli-v1.2.3')).toBe('1.2.3');
});
