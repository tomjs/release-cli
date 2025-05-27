import type { Changelog, GitTagInfo, ReleaseOptions } from './types';
import path from 'node:path';
import chalk from 'chalk';
import dayjs from 'dayjs';
import isSubdir from 'is-subdir';
import semver from 'semver';
import { ReleaseError } from './error';
import { logger } from './logger';
import { run } from './utils';

/**
 * Check if the current directory is a git repository.
 */
export async function checkGitRepo() {
  await run(`git rev-parse --is-inside-work-tree`)
    .then((res) => {
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
  return await run(['git', 'rev-parse', '--show-toplevel'], { trim: true });
}

/**
 * Get git changed files since the given ref.
 * @param ref
 * @param fullPath whether to return full path, default is false
 */
export async function getChangedFilesSince(ref: string, fullPath = false): Promise<Array<string>> {
  try {
    const divergedAt = await getDivergedCommit(ref);
    if (!divergedAt) {
      return [];
    }

    const res = await run(['git', 'diff', '--name-only', divergedAt]);

    const files = res.split('\n').filter(a => a);
    if (!fullPath)
      return files;

    const repoRoot = await getRepoRoot();
    return files.map(file => path.resolve(repoRoot, file));
  }
  catch (e: any) {
    logger.error(e.message);
  }
  return [];
}

/**
 * Get the commit SHA that diverged from the given ref.
 * @param ref The ref to check against.
  The commit SHA that diverged from the given ref.
 */
export async function getDivergedCommit(ref: string) {
  try {
    return await run(['git', 'merge-base', ref, 'HEAD']);
  }
  catch {}
}

/**
 * Get the package names that have changed since the given ref.
  The list of package names that have changed.
 */
export async function getChangedPackageNames(opts: ReleaseOptions) {
  const { pkgs, branch } = opts;
  const changedFiles = await getChangedFilesSince(branch!, true);
  return pkgs
    .map(s => ({ name: s.name, dir: s.dir }))
    .filter((pkg) => {
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

/**
 * Clear git tag name and return version only
 * @param tag
 */
export function clearTagVersion(tag: string) {
  const matchArr = tag.match(/(?:@|v)([^@v]+)$/);
  if (!matchArr || matchArr.length === 0) {
    return tag;
  }

  if (matchArr.length === 1) {
    return matchArr[0];
  }

  return matchArr[1];
}

export interface GitTagVersionOptions {
  isMonorepo?: boolean;
  scopedTag?: boolean;
  lineTag?: boolean;
}

export function getGitTagPrefixRelease(name: string, isMonorepo?: boolean) {
  return getGitTagPrefix(name, { isMonorepo, scopedTag: false, lineTag: false });
}

export function getGitTagVersionRelease(name: string, version: string, isMonorepo?: boolean) {
  return getGitTagPrefixRelease(name, isMonorepo) + version;
}

export function getGitTagPrefix(name: string, opts: GitTagVersionOptions) {
  const { isMonorepo, scopedTag, lineTag } = opts;
  if (isMonorepo) {
    const names = name.split('/');
    if (lineTag) {
      const pre = scopedTag ? name.replace('@', '').replace('/', '-') : names[names.length - 1];
      return `${pre}-v`;
    }

    const pre = scopedTag ? name : names[names.length - 1];
    return `${pre}@`;
  }
  return 'v';
}

export function getGitTagVersion(name: string, version: string, opts: GitTagVersionOptions) {
  return getGitTagPrefix(name, opts) + version;
}

/**
 * Get the latest tag of the packages.
 */
export async function getGitTags(opts: ReleaseOptions) {
  const { isMonorepo, pkgs } = opts;
  const pkgNames = isMonorepo ? pkgs.map(s => s.name) : [];

  // compatible with old version
  const prefixMap: Record<string, string> = {};
  if (isMonorepo) {
    pkgs.forEach((pkg) => {
      const { name, tagName } = pkg;
      prefixMap[getGitTagPrefix(name, { isMonorepo, scopedTag: true, lineTag: false })] = name;
      prefixMap[getGitTagPrefix(name, { isMonorepo, scopedTag: false, lineTag: false })] = name;
      prefixMap[getGitTagPrefix(name, { isMonorepo, scopedTag: true, lineTag: true })] = name;
      prefixMap[getGitTagPrefix(name, { isMonorepo, scopedTag: false, lineTag: true })] = name;

      prefixMap[getGitTagPrefix(tagName, { isMonorepo, scopedTag: true, lineTag: false })] = name;
      prefixMap[getGitTagPrefix(tagName, { isMonorepo, scopedTag: false, lineTag: false })] = name;
      prefixMap[getGitTagPrefix(tagName, { isMonorepo, scopedTag: true, lineTag: true })] = name;
      prefixMap[getGitTagPrefix(tagName, { isMonorepo, scopedTag: false, lineTag: true })] = name;
    });
  }

  const prefixKeys = Object.keys(prefixMap);

  const records = await run(
    `git for-each-ref --format="%(refname:short) %(creatordate)" refs/tags`,
  );
  const map: Record<string, GitTagInfo[]> = {};
  const add = (record: string) => {
    const [tag, ...times] = record.split(' ');
    const version = clearTagVersion(tag);

    let pkgName = '';

    // single package
    if (tag === `v${version}` || tag === version) {
      pkgName = '_';
    }
    else {
      const prefix = prefixKeys.find(pre => tag === `${pre}${version}`);
      if (prefix) {
        pkgName = prefixMap[prefix];
      }
    }
    if (!pkgName) {
      return;
    }

    map[pkgName] = (map[pkgName] || []).concat([
      {
        name: tag,
        version,
        time: dayjs(times.join(' ')).format('YYYY-MM-DD'),
      },
    ]);
  };

  records.split(/\n/).forEach((record) => {
    if (!record) {
      return;
    }
    add(record);
  });

  Object.keys(map).forEach((name) => {
    if (Array.isArray(pkgNames) && pkgNames.length && !pkgNames.includes(name)) {
      delete map[name];
      return;
    }
    map[name].sort((a, b) => {
      return semver.gte(b.version, a.version) ? 1 : -1;
    });
  });

  return map;
}

/**
 * Get git tag commits
 * @param tags
 * @param dir
 */

export async function getCommitsByTags(tags: string[], dir: string) {
  return run(
    `git --no-pager log ${tags.filter(s => s).join('...')} --pretty="format:%h %s" -- ${dir}`,
  );
}

export async function getCurrentGitSHA() {
  try {
    const sha = await run(`git rev-parse HEAD`, { trim: true });
    return sha ? sha.substring(0, 7) : sha;
  }
  catch {}
}

/**
 * Get git repository hosted url
 */
export async function getRepositoryUrl() {
  try {
    let url: string | undefined;
    const res = await run(`git remote -v`);
    const list = res
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    if (list.length) {
      url = list[0].split('\t')[1].trim();
      url = url.split(' ')[0];
    }
    return url;
  }
  catch {}
}

export function releaseNotes(changelog: Changelog, opts: ReleaseOptions) {
  return changelog.commits
    .map((c) => {
      let txt = `- ${c.msg}`;
      if (opts.logCommit && opts.gitCommitUrl) {
        txt += c.ids.map(id => `  [${id}](${opts.gitCommitUrl?.replace(/\{sha\}/g, id)})`).join('  ');
      }

      return txt;
    })
    .join('\n');
}

export function releaseCompareUrl(changelog: Changelog, opts: ReleaseOptions) {
  const tags = changelog.tags.filter(s => s);
  if (opts.logCompare && opts.gitCompareUrl && tags.length > 1) {
    return `${opts.gitCompareUrl.replace(/\{diff\}/g, tags.map(s => encodeURIComponent(s.name)).join('...'))}`;
  }
}

export async function resetGitSubmit(opts: ReleaseOptions) {
  const { pkgs, gitSHA } = opts;
  if (!pkgs || pkgs.length === 0 || !gitSHA) {
    return;
  }

  // remote git tag
  for (const pkg of pkgs) {
    const tag = getGitTagVersion(pkg.tagName, pkg.version, opts);
    const res = await run(`git tag -l ${tag}`);
    if (res) {
      await run(`git tag -d ${tag}`);
    }
  }

  // reset git commit
  const res = await run(`git --no-pager log -n ${pkgs.length}  --pretty="format:%h"`);
  const shaList = res
    .split('\n')
    .map(s => s.trim())
    .filter(s => s);

  for (const sha of shaList) {
    if (sha === gitSHA) {
      return;
    }
    await run(`git reset --hard ${sha}`);
  }
}
