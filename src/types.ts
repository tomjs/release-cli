import type { PackageManager } from '@tomjs/pkg';
import type { PackageJson } from 'type-fest';
import type { ReleaseCLIOptions } from '../index';

export interface GitTagInfo {
  name: string;
  version: string;
  time: string;
}

export interface GitCommit {
  msg: string;
  ids: string[];
}

export interface Changelog {
  tags: GitTagInfo[];
  commits: GitCommit[];
}

export interface NpmInfo {
  'name': string;
  'version': string;
  'versions': string[];
  'dist-tags': Record<string, string>;
}

export interface PackageInfo {
  /** npm package name */
  name: string;
  /** git tag name */
  tagName: string;
  /** npm package version */
  version: string;
  /** npm package new version */
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
  /**
   * The npm info from npm registry.
   */
  npmInfo: NpmInfo;
}

export type { ReleaseCLIOptions };

export interface ReleaseOptions extends ReleaseCLIOptions {
  packageManager: PackageManager;
  pkgs: PackageInfo[];
  isMonorepo: boolean;
  /** git commit SHA (before release) */
  gitSHA?: string;
}
