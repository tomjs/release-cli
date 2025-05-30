import type { Options as ExecaOptions } from 'execa';
import type { Ora } from 'ora';
import type { ReleaseCLIOptions } from './types';
import chalk from 'chalk';
import { $ } from 'execa';
import inquirer from 'inquirer';
import ora from 'ora';
import { ReleaseError } from './error';
import { logger } from './logger';

/**
 * Joins an array of strings into a string with comma and space separator.
 * @param arr The array of strings to join.
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
 * create terminal spinner.
 * @param msg display message
 */
export function createSpin(msg: string) {
  return ora(fixOraDisplay(msg)).start();
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
    }
    else {
      logger.write(str);
    }
  };

  log(`$ ${cmd}`);

  let spin: Ora | undefined;
  if (spinner) {
    const msg = typeof spinner === 'string' ? spinner : 'Running...';
    spin = createSpin(msg);
  }

  if (dryRun) {
    spin && spin.stop();
    return typeof dryRun === 'string' ? dryRun : '';
  }

  try {
    const { stdout } = await $(execOpts)`${cmd}`;
    const std = Array.isArray(stdout) ? stdout.join('\n') : (stdout as string) || '';
    spin && spin.stop();

    log(std);

    if (trim) {
      return std.trim().replace(/\n|\r/g, '');
    }
    return std.trim();
  }
  catch (e: any) {
    spin && spin.stop();

    const msg = e.stderr || e.message;

    log(msg);

    throw new ReleaseError(msg);
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
