import type { ReleaseType } from 'semver';
import type { PackageJson } from 'type-fest';
import type { PackageManager } from './manager.js';

export interface PackageInfo {
  name: string;
  version: string;
  newVersion: string;
  tag: string;
  access: 'public' | 'restricted';
  registry: string;

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
  strict?: boolean;
  verbose?: boolean;
}

export interface ReleaseOptions extends ReleaseCLIOptions {
  packageManager: PackageManager;
  pkgs: PackageInfo[];
  isMonorepo: boolean;
}
