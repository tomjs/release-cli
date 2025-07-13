import type { ReleaseType } from 'semver';

export interface ReleaseCLIOptions {
  type?: ReleaseType;
  cwd?: string;
  config?: string;
  gitChecks?: boolean;
  anyBranch?: boolean;
  branch?: string;
  preid?: string;
  tag?: string;
  scopedTag?: boolean;
  lineTag?: boolean;
  log?: boolean;
  logFull?: boolean;
  logCommit?: boolean;
  logCompare?: boolean;
  gitUrl?: string;
  gitCommitUrl?: string;
  gitCompareUrl?: string;
  publish?: boolean;
  build?: boolean;
  tagMerge?: boolean;
  otp?: string;
  releaseDraft?: boolean;
  dryRun?: boolean;
  strict?: boolean;
  onlyPublish?: boolean;
  verbose?: boolean;
}
