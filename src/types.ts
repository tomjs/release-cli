import type { ReleaseType } from 'semver';
import type { PackageJson } from 'type-fest';

export interface PackageInfo {
  name: string;
  version: string;
  newVersion: string;
  tag: string;

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
  preid?: string;
  tag?: string;
  verbose?: boolean;
}

export interface ReleaseOptions extends ReleaseCLIOptions {
  pkgs: PackageInfo[];
  isMonorepo: boolean;
}
