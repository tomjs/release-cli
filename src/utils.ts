import chalk from 'chalk';
import type { Options as ExecaOptions } from 'execa';
import { $ } from 'execa';
import type { Ora } from 'ora';
import ora from 'ora';
import { logger } from './logger.js';
import type { ReleaseCLIOptions } from './types.js';

/**
 * Joins an array of strings into a string with comma and space separator.
 * @param arr The array of strings to join.
 * @returns
 */
export function joinArray(arr: string[], color = chalk.green): string {
  return arr.map(s => (color ? `"${color(s)}"` : `"${s}"`)).join(', ');
}

let _opts: ReleaseCLIOptions = {
  cwd: '.',
};

export function setOptions(opts: ReleaseCLIOptions) {
  _opts = opts;
}

export function getOptions() {
  return _opts;
}

function fixOraDisplay(display: string) {
  if (!display.endsWith('\n')) {
    display += '\n';
  }
  return display;
}

interface RunExecaOptions extends ExecaOptions {
  /**
   * Whether to clear the command output, replace \r and \n to ""
   * @default false
   */
  trim?: boolean;
  /**
   * spinner display content
   */
  spinner?: boolean | string;
}

/**
 * run a command
 * @param cmd command
 * @param options custom and execa options
 */
export async function run(cmd: string, options?: RunExecaOptions): Promise<string>;
/**
 * run a command
 * @param cmd a command array, will be joined by space
 * @param options custom and execa options
 */
export async function run(cmd: string[], options?: RunExecaOptions): Promise<string>;

export async function run(cmd: string | string[], options?: RunExecaOptions): Promise<string> {
  const { trim, spinner, ...execOpts } = Object.assign(
    {
      stdio: 'pipe',
      shell: true,
      cwd: _opts.cwd,
    } as RunExecaOptions,
    options,
  );
  execOpts.cwd ??= _opts.cwd;

  if (Array.isArray(cmd)) {
    cmd = cmd.join(' ');
  }

  const log = (str: string) => {
    if (_opts.verbose) {
      logger.debug(str);
    } else {
      logger.write(str);
    }
  };

  log(`$ ${cmd}`);

  let spin: Ora | undefined;
  if (spinner) {
    const msg = typeof spinner === 'string' ? spinner : 'Running...';
    spin = ora(fixOraDisplay(msg)).start();
  }

  try {
    const { stdout } = await $(execOpts)`${cmd}`;

    spin && spin.stop();

    log(stdout);

    if (trim) {
      return stdout.trim().replace(/\n|\r/g, '');
    }
    return stdout.trim();
  } catch (e: any) {
    spin && spin.stop();

    const { stderr } = e;

    log(stderr);

    return Promise.reject(stderr);
  }
}

/**
 * Whether the package name is scoped
 * @param name package name
 */
export function isScopedPackage(name: string) {
  return name.startsWith('@');
}

export function getScope(name: string) {
  return isScopedPackage(name) ? name.split('/')[0] : '';
}

/**
 * Remove URL trailing slashes
 * @param url
 * @returns
 */
export function removeTrailingSlashes(url: string) {
  return url.replace(/\/+$/, '');
}
