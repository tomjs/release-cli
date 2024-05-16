# @tomjs/release-cli

[![npm](https://img.shields.io/npm/v/@tomjs/release-cli)](https://www.npmjs.com/package/@tomjs/release-cli) ![node-current (scoped)](https://img.shields.io/node/v/@tomjs/release-cli) ![NPM](https://img.shields.io/npm/l/@tomjs/release-cli)

**English** | [中文](./README.zh_CN.md)

> A `CLI` tool to automatically publish `npm` packages.

## Notice

- This tool learns and refers to the excellent [np](https://github.com/sindresorhus/np) and [changesets](https://github.com/changesets/changesets)
- This tool is only used for learning and communication. It is not recommended for others to use for important projects. It is recommended to use the above tools

## Features

- You can select or customize the `npm` version number and `dist-tag`
- Automatically generate `changelog` based on `git` information
- Automatically publish to `https://registry.npmjs.org`
- Create github release link

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
  --cwd                 The current working directory (default: ".")
  --config              Specify the config file path (eg. rc.config.json)
  --preid               Specify the pre-release identifier, allowed values are "", "alpha", "beta", "rc".
                        If type is "prerelease", "prepatch", "preminor", "premajor",
                        the preid will be used as the pre-release identifier (default: "alpha").
                        If type is "patch", "minor", "major", the preid will be ignored.
  --no-git-check        Skips checking git status
  --any-branch          Allow publishing from any branch (default: false)
  --branch              Name of the release branch (default: main | master)
  --tag <tag>           Publish under a given dist-tag (default: "latest")
  --no-scoped-tag       Don't Use scoped package name as git tag
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
  --no-build            Skips run build script before publishing
  --no-tag-merge        When publishing multiple packages, each package has its own independent tag and commit
  --otp                 This is a one-time password from a two-factor authenticator
  --no-release-draft    Skips opening a GitHub release draft
  --dry-run             Don't actually release, just simulate the process
  --verbose             Display verbose output
  -h, --help            Display this message
  -v, --version         Display version number
```

## Configuration File

You can configure `release-cli` via (in order of precedence):

- A "`rc`" key in your `package.json` file.
- A `rc.config.json` file.
- A `rc.config.js` file that exports an object using `export default` or `module.exports` (depends on the type value in your package.json).
- A `rc.config.mjs` file that exports an object using export default.
- A `rc.config.cjs` file that exports an object using module.exports.
