import type { ReleaseType } from 'semver';
import type { PackageJson } from 'type-fest';
import type { PackageManager } from './manager.js';

export interface NpmTagInfo {
  name: string;
  version: string;
  time: string;
}

export interface GitCommit {
  msg: string;
  ids: string[];
}

export interface Changelog {
  tags: NpmTagInfo[];
  commits: GitCommit[];
}

export interface NpmInfo {
  version: string;
  versions: string[];
  'dist-tags': Record<string, string>;
}

export interface PackageInfo {
  name: string;
  version: string;
  newVersion: string;
  /** npm publish tag */
  tag: string;
  scoped?: boolean;
  /** npm publish access */
  access: 'public' | 'restricted';
  /** npm registry */
  registry: string;
  /** git repo */
  repository?: string;
  changelogs?: Changelog[];

  // copy from @manypkg/get-packages
  /**
   * Absolute path to the directory containing this package.
   */
  dir: string;
  /**
   * Relative path to the directory containing this package, relative to the monorepo
   * root (for a "root package", this is the string ".").
   */
  relativeDir: string;
  /**
   * The pre-loaded package json structure.
   */
  packageJson: PackageJson;
}

export interface ReleaseCLIOptions {
  type?: ReleaseType;
  cwd: string;
  anyBranch?: boolean;
  branch?: string;
  preid?: string;
  tag?: string;
  log?: boolean;
  logFull?: boolean;
  logCommit?: boolean;
  logCompare?: boolean;
  gitUrl?: string;
  gitCommitUrl?: string;
  gitCompareUrl?: string;
  strict?: boolean;
  verbose?: boolean;
}

export interface ReleaseOptions extends ReleaseCLIOptions {
  packageManager: PackageManager;
  pkgs: PackageInfo[];
  isMonorepo: boolean;
}
