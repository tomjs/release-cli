import chalk from 'chalk';
import { execa } from 'execa';
import semver from 'semver';
import { getGitTagVersion, getRepositoryUrl, releaseCompareUrl, releaseNotes } from './git.js';
import { logger } from './logger.js';
import type { TwoFactorState } from './npm.js';
import { getNpmEnv, getOtpCode, getTwoFactorState, updatePackageVersion } from './npm.js';
import type { PackageInfo, ReleaseOptions } from './types.js';
import { run } from './utils.js';

export async function runPublish(opts: ReleaseOptions) {
  await bumpVersionAndTag(opts);
  await runPublishPackages(opts);
  await runGithubRelease(opts);
}

async function bumpVersionAndTag(opts: ReleaseOptions) {
  if (!opts.tagOne) {
    return;
  }

  logger.info(chalk.green('Bump version and tag'));

  const { pkgs: pkgs, dryRun } = opts;
  for (const pkg of pkgs) {
    updatePackageVersion(pkg);
  }

  await run('git add -A', { dryRunOption: dryRun });

  const tags = pkgs.map(s => getGitTagVersion(s.name, s.version, opts.isMonorepo));
  await run(`git commit -m "chore: release ${tags.join(', ')}"`, { dryRunOption: dryRun });

  for (const tag of tags) {
    await run(`git tag ${tag}`, { dryRun });
  }
}

async function runPublishPackages(opts: ReleaseOptions) {
  const { pkgs } = opts;
  const twoFactorState = getTwoFactorState(opts);

  for (const pkg of pkgs) {
    await publicOnePackage(pkg, opts, twoFactorState);
    const tag = `${pkg.name}@${pkg.newVersion}`;
    logger.success(`Publish ${chalk.green(tag)} successfully 🎉!`);
  }

  const gitUrl = await getRepositoryUrl();
  if (gitUrl) {
    try {
      await run(`git push --follow-tags`, { dryRunOption: opts.dryRun });
    } catch {
      await run(`git push --tags`, { dryRunOption: opts.dryRun });
    }
  }
}

async function publicOnePackage(
  pkg: PackageInfo,
  opts: ReleaseOptions,
  twoFactorState: TwoFactorState,
) {
  const { packageManager: pm } = opts;
  const args: string[] = ['publish', '--access', pkg.access, '--tag', pkg.tag];

  if (pm.id === 'pnpm') {
    args.push('--no-git-checks');
  }

  if (pm.id === 'yarn') {
    args.push('--version=', pkg.newVersion);
  }

  if (await twoFactorState.isRequired) {
    await getOtpCode(twoFactorState);
  }

  let cli: string = pm.cli;
  if (pm.id === 'berry') {
    cli = 'yarn npm';
  }

  const getArgs = () => {
    const otp = twoFactorState.token;
    if (otp) {
      return [...args, '--otp', otp];
    }
    return [...args];
  };

  const cmd = [cli].concat(getArgs()).join(' ');
  logger.debug(cmd);

  try {
    await runNpmPublish(cli, getArgs(), pkg);
    twoFactorState.tryAgain = false;
  } catch (e: any) {
    if (e && needOtp(e.message)) {
      if (twoFactorState.token !== null) {
        // the current otp code must be invalid since it errored
        twoFactorState.token = null;
      }
      twoFactorState.tryAgain = true;
      await publicOnePackage(pkg, opts, twoFactorState);
    } else {
      throw e;
    }
  }
}

const needOtp = (text: string) =>
  text.includes('code EOTP') || // npm/pnpm
  text.includes('--otp=<code>') || // npm/pnpm
  text.includes('Two factor authentication') || // yarn v1
  text.includes('One-time password:'); // yarn berry

function runNpmPublish(file: string, args: string[], pkg: PackageInfo) {
  const cp = execa(file, args, { cwd: pkg.dir, env: getNpmEnv() });

  cp.stdout!.on('data', chunk => {
    // https://github.com/yarnpkg/berry/blob/a3e5695186f2aec3a68810acafc6c9b1e45191da/packages/plugin-npm/sources/npmHttpUtils.ts#L541
    if (chunk.toString('utf8').includes('One-time password:')) {
      cp.kill();
    }
  });

  return cp;
}

async function runGithubRelease(opts: ReleaseOptions) {
  if (!opts.gitUrl || !opts.releaseDraft) {
    return;
  }
  const repoUrl = new URL(opts.gitUrl);
  if (repoUrl.host !== 'github.com') {
    return;
  }

  const { pkgs } = opts;
  for (const pkg of pkgs) {
    const repoUrl = new URL(opts.gitUrl);

    repoUrl.pathname += '/releases/new';

    const { newVersion: version, changelogs } = pkg;
    repoUrl.searchParams.set('tag', getGitTagVersion(pkg.name, version, opts.isMonorepo));
    const pre = semver.parse(version)?.prerelease;
    repoUrl.searchParams.set('prerelease', pre && pre.length ? 'true' : 'false');

    let msg = '';
    if (changelogs && changelogs.length) {
      const changelog = changelogs[0];
      msg = releaseNotes(changelog, opts) || `- No Change`;
      msg += `\n\n${releaseCompareUrl(changelog, opts)}`;
    }

    repoUrl.searchParams.set('body', msg);

    logger.success(`${chalk.blue(pkg.name)} github release: ${chalk.green(repoUrl.toString())}`);
  }
}
