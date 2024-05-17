import fs from 'node:fs';
import path from 'node:path';
import { getPackages } from '@manypkg/get-packages';
import chalk from 'chalk';
import dayjs from 'dayjs';
import {
  getCommitsByTags,
  getGitTags,
  getGitTagVersion,
  releaseCompareUrl,
  releaseNotes,
} from './git.js';
import { logger } from './logger.js';
import { getNpmInfo, getNpmRegistry, updatePackageVersion } from './npm.js';
import type { GitCommit, GitTagInfo, PackageInfo, ReleaseOptions } from './types.js';
import { askYesOrNo, cancelAndExit, run } from './utils.js';

export async function runGenerateChangelog(opts: ReleaseOptions) {
  if (!opts.log) {
    logger.warning(`Skip generate changelog.`);
    return opts;
  }

  const { isMonorepo, pkgs } = opts;
  const pkgNames = pkgs.map(s => s.name);
  const pkgTags = await getGitTags(isMonorepo ? pkgNames : []);

  const depVersions = await getDependencyVersions(opts);

  for (const pkgName of pkgNames) {
    const pkg = pkgs.find(s => s.name === pkgName)!;

    const name = isMonorepo ? pkgName : '_';
    const pkgTag = pkgTags[name] || [];
    const tags: GitTagInfo[] = [
      {
        name: 'HEAD',
        version: pkg.newVersion,
        time: dayjs().format('YYYY-MM-DD'),
      },
    ].concat(pkgTag);

    pkg.changelogs = [];

    // check deps
    for (let i = 0; i < tags.length; i++) {
      const list = [tags[i]];
      if (i < tags.length) {
        list.splice(0, 0, tags[i + 1]);
      }

      logger.log(
        `${chalk.green(pkg.name)} Commits of ${list
          .filter(s => s)
          .map(s => chalk.green(s.name))
          .join('...')}:`,
      );
      console.log();

      const tagNames = list.map(s => (s ? s.name : ''));
      const logs = await getCommitsByTags(tagNames, pkg.relativeDir);
      const commits = parseCommitLog(logs);

      if (i === 0) {
        const dep = depVersions[pkg.name];
        if (dep) {
          commits.push({
            msg: `chore: update ${dep}`,
            ids: [],
          });
        }
      }

      console.log(
        commits.map(s => s.msg + (s.ids.length > 0 ? ` ${s.ids.join(' ')}` : '')).join('\n'),
      );

      pkg.changelogs.push({
        tags: tagNames.map(name => {
          const item = tags.find(s => s.name === name)!;
          if (item && item.name === 'HEAD') {
            item.name = getGitTagVersion(pkg.name, item.version, opts);
          }

          return item;
        }),
        commits,
      });

      if (!opts.logFull) {
        break;
      }
    }
  }

  // no change
  if (!opts.logFull) {
    const noChanges = pkgs
      .filter(
        pkg =>
          !pkg.changelogs || pkg.changelogs.length === 0 || pkg.changelogs[0].commits.length === 0,
      )
      .map(s => s.name);

    if (noChanges.length) {
      const ask = await askYesOrNo(
        `No changes found for ${noChanges.join(', ')}, Do you want to continue?`,
      );
      if (!ask) {
        cancelAndExit();
      }
    }
  }

  await createChangelog(opts);

  return opts;
}

function parseCommitLog(log: string) {
  const commits: GitCommit[] = [];
  log
    .split('\n')
    .map(s => s.trim())
    .filter(s => s)
    .forEach(s => {
      const [sha, ...rest] = s.split(' ');
      const msg = rest.join(' ');
      // ignore merge and release commit
      if (msg.startsWith('Merge http') || msg.startsWith('chore: release')) {
        return;
      }

      const log = commits.find(s => s.msg === msg);
      if (log) {
        log.ids.push(sha);
      } else {
        commits.push({ msg, ids: [sha] });
      }
    });

  return commits;
}

async function createChangelog(opts: ReleaseOptions) {
  const { pkgs, dryRun } = opts;
  for (const pkg of pkgs) {
    logger.info(`create changelog for ${chalk.green(pkg.name)}`);

    const logPath = path.join(pkg.dir, 'CHANGELOG.md');
    let content = '';
    if (opts.logFull) {
      content = '';
    } else if (fs.existsSync(logPath)) {
      content = fs.readFileSync(logPath, 'utf8');
    }

    const { changelogs = [] } = pkg;

    pkg.changelogs?.reverse();

    for (const changelog of changelogs) {
      const tags = changelog.tags.filter(s => s);

      let title = pkg.newVersion;
      let msg = '';
      if (tags.length) {
        msg = releaseNotes(changelog, opts);

        const tag = tags[tags.length - 1];
        title = tag.version;
        const url = releaseCompareUrl(changelog, opts);
        if (url) {
          title = `[${title}](${url})`;
        }
        title += ` (${tag.time})`;
      }

      content = `## ${title}\n\n${msg || `- No Change`}\n\n` + content;
    }

    pkg.changelogs?.reverse();

    if (dryRun) {
      console.log(content);
    } else {
      fs.writeFileSync(logPath, content, 'utf8');
    }

    if (!opts.tagMerge) {
      await bumpVersionAndTag(pkg, opts);
    }
  }
}

async function bumpVersionAndTag(pkg: PackageInfo, opts: ReleaseOptions) {
  const { dryRun } = opts;
  // update version
  !dryRun && updatePackageVersion(pkg);

  await run('git add .', { cwd: pkg.dir, dryRun });
  const tag = getGitTagVersion(pkg.name, pkg.newVersion, opts);
  await run(`git commit  -m "chore: release ${tag}"`, {
    cwd: pkg.dir,
    dryRun,
  });
  await run(`git tag ${tag}`, { cwd: pkg.dir, dryRun });
}

async function getDependencyVersions(opts: ReleaseOptions) {
  const { pkgs, packageManager: pm } = opts;

  const { packages } = await getPackages(opts.cwd!);
  const pkgNames = packages.map(pkg => pkg.packageJson.name);
  const allVersions: Record<string, string> = {};
  const allPackages = packages
    .filter(s => !s.packageJson.private)
    .map(s => {
      return {
        ...s,
        name: s.packageJson.name,
        version: s.packageJson.version,
      } as PackageInfo;
    });

  const getPkg = async (name: string) => {
    let pkg = pkgs.find(s => s.name === name);
    if (!pkg) {
      pkg = allPackages.find(s => s.name === name);
      if (pkg) {
        pkg.registry = await getNpmRegistry(pm, pkg);
      }
    }
    return pkg!;
  };

  const getVersion = async (name: string) => {
    const item = allVersions[name];
    if (item !== undefined) {
      return item;
    }

    const pkg = await getPkg(name);
    if (pkg.newVersion) {
      return pkg.newVersion;
    }

    let npmInfo = pkg.npmInfo;
    if (!npmInfo) {
      npmInfo = await getNpmInfo(pkg);
    }
    const remote = npmInfo?.version;
    let version = pkg.version;
    if (remote && remote === remote) {
      version = '';
    }

    allVersions[name] = version;
    return version;
  };

  const versions: Record<string, string> = {};
  for (const pkg of opts.pkgs) {
    const deps = pkg.packageJson.dependencies;
    if (!deps) {
      continue;
    }

    const names: string[] = [];
    for (const key of Object.keys(deps)) {
      if (pkgNames.includes(key)) {
        const v = await getVersion(key);
        if (v) {
          names.push(`${key}@${v}`);
        }
      }
    }

    if (names.length) {
      versions[pkg.name] = names.join(', ');
    }
  }

  return versions;
}
