import path from 'node:path';
import chalk from 'chalk';
import isSubdir from 'is-subdir';
import { ReleaseError } from './error.js';
import { logger } from './logger.js';
import type { ReleaseOptions } from './types.js';
import { run } from './utils.js';

/**
 * Check if the current directory is a git repository.
 */
export async function checkGitRepo() {
  await run(`git rev-parse --is-inside-work-tree`)
    .then(res => {
      if (res !== 'true') {
        throw new Error('Not a git repository.');
      }
    })
    .catch(() => {
      throw new Error('Not a git repository.');
    });
}

/**
 * Check if the current directory is clean.
 */
export async function checkWorkStatus() {
  const res = await run(`git status --porcelain`);
  ReleaseError.assert(!res, 'Unclean working tree. Commit or stash changes first.');
}

/**
 * Check if the current branch is allowed.
 */
export async function checkBranch(branch?: string) {
  const b = await run(`git rev-parse --abbrev-ref HEAD`);
  const allowedList = branch ? [branch] : ['master', 'main'];
  ReleaseError.assert(
    allowedList.includes(b),
    `Current ${chalk.red(b)} branch is not master or main.`,
  );
  return b;
}

async function getRepoRoot() {
  return await run(['git', 'rev-parse', '--show-toplevel'], { clear: true });
}

/**
 * Get git changed files since the given ref.
 * @param ref
 * @param fullPath whether to return full path, default is false
 * @returns
 */
export async function getChangedFilesSince(ref: string, fullPath = false): Promise<Array<string>> {
  try {
    const divergedAt = await getDivergedCommit(ref);
    if (!divergedAt) {
      return [];
    }

    const res = await run(['git', 'diff', '--name-only', divergedAt]);

    const files = res.split('\n').filter(a => a);
    if (!fullPath) return files;

    const repoRoot = await getRepoRoot();
    return files.map(file => path.resolve(repoRoot, file));
  } catch (e: any) {
    logger.error(e.message);
  }
  return [];
}

/**
 * Get the commit SHA that diverged from the given ref.
 * @param ref The ref to check against.
 * @returns The commit SHA that diverged from the given ref.
 */
export async function getDivergedCommit(ref: string) {
  try {
    return await run(['git', 'merge-base', ref, 'HEAD']);
  } catch {}
}

/**
 * Get the package names that have changed since the given ref.
 * @returns The list of package names that have changed.
 */
export async function getChangedPackageNames(opts: ReleaseOptions) {
  const { pkgs, branch } = opts;
  const changedFiles = await getChangedFilesSince(branch!, true);
  return pkgs
    .map(s => ({ name: s.name, dir: s.dir }))
    .filter(pkg => {
      const changedPackageFiles: string[] = [];

      for (let i = changedFiles.length - 1; i >= 0; i--) {
        const file = changedFiles[i];

        if (isSubdir(pkg.dir, file)) {
          changedFiles.splice(i, 1);
          const relativeFile = file.slice(pkg.dir.length + 1);
          changedPackageFiles.push(relativeFile);
        }
      }

      return changedPackageFiles.length > 0;
    })
    .map(s => s.name);
}
