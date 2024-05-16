import chalk from 'chalk';
import type { Options as ExecaOptions } from 'execa';
import { $ } from 'execa';
import inquirer from 'inquirer';
import type { Ora } from 'ora';
import ora from 'ora';
import { ReleaseError } from './error.js';
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

  /**
   * Whether to run the command in dry run mode, will print the command without running it
   * @default false
   */
  dryRun?: boolean | string;
  /**
   * Whether to add --dry-run option to the command, will be ignored if dryRun is true
   * @default false
   */
  dryRunOption?: boolean;
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
  const { trim, spinner, dryRun, dryRunOption, ...execOpts } = Object.assign(
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

  if (dryRunOption) {
    cmd += ' --dry-run';
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

  if (dryRun) {
    spin && spin.stop();
    return typeof dryRun === 'string' ? dryRun : '';
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

    const msg = e.stderr || e.message;

    log(msg);

    return Promise.reject(msg);
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

export function cancelAndExit(message?: string) {
  return ReleaseError.exit(message || 'Canceled... 👋');
}

/**
 * 是否
 * @param message
 */
export async function askYesOrNo(message: string) {
  const name = `Question-${Date.now()}`;
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name,
      message,
    },
  ]);

  return answer[name];
}
