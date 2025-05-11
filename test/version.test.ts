import chalk from 'chalk';
import { expect, it } from 'vitest';
import { diffColor } from '../src/version.js';

it('version.diffColor', () => {
  expect(diffColor('1.0.0', '1.1.0')).toBe(`1.${chalk.green('1')}.0`);
});
