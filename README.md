# @tomjs/release-cli

[![npm](https://img.shields.io/npm/v/@tomjs/release-cli)](https://www.npmjs.com/package/@tomjs/release-cli) ![node-current (scoped)](https://img.shields.io/node/v/@tomjs/release-cli) ![NPM](https://img.shields.io/npm/l/@tomjs/release-cli)

**English** | [中文](./README.zh_CN.md)

> A `CLI` tool to automatically publish `npm` packages.

## Notice

- This tool learns and refers to the excellent [np](https://github.com/sindresorhus/np) and [changesets](https://github.com/changesets/changesets)
- This tool is only used for learning and communication. It is not recommended for others to use for important projects. It is recommended to use the above tools

## Prerequisite

| name     | version |
| -------- | ------- |
| **node** | >= 18   |
| **git**  | >= 2.11 |
| npm      | >= 7    |
| pnpm     | >= 8    |

## Install

```bash
# pnpm
pnpm add @tomjs/release-cli -D

# yarn
yarn add @tomjs/release-cli -D

# npm
npm add @tomjs/release-cli -D
```

## Usage

```bash
$ rc -h

A CLI tool to automatically publish npm packages.

Usage
  $ rc [type] [options]

  Type can be:
    patch | minor | major | prepatch | preminor | premajor | prerelease

Options
  --cwd <cwd>           The current working directory (default: ".")
  --preid               Specify the pre-release identifier, allowed values are "", "alpha", "beta", "rc".
                        If type is "prerelease", "prepatch", "preminor", "premajor",
                        the preid will be used as the pre-release identifier (default: "alpha").
                        If type is "patch", "minor", "major", the preid will be ignored.
  --no-git-check        Skips checking git status (default: false)
  --any-branch          Allow publishing from any branch (default: false)
  --branch              Name of the release branch (default: main | master)
  --tag <tag>           Publish under a given dist-tag (default: "latest")
  --scoped-tag          Use scoped package name as git tag (default: false)
  --no-log              Skips generating changelog
  --log-full            Generate a full changelog and replace the existing content (default: false)
  --no-log-commit       Don't add git commit SHA and link to the changelog
  --no-log-compare      Don't add git compare link to the changelog
  --git-url             Specify the git web url. If not specified, the configuration of git or package.json will be read,
                        such as "https://github.com/tomjs/release-cli"
  --git-commit-url      Git commit url template, default: "{url}/commit/{sha}"
  --git-compare-url     Git compare url template, default: "{url}/compare/{diff}"
  --strict              Strict mode, will make some checks more strict (default: false)
  --no-publish          Skips publishing
  --tag-one             When publishing multiple packages, only one git tag and commit (default: false)
  --otp                 This is a one-time password from a two-factor authenticator
  --no-release-draft    Skips opening a GitHub release draft
  --dry-run             Don't actually release, just simulate the process
  --verbose             Display verbose output
  -h, --help            Display this message
  -v, --version         Display version number
```
