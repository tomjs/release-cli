# @tomjs/release-cli

[![npm](https://img.shields.io/npm/v/@tomjs/release-cli)](https://www.npmjs.com/package/@tomjs/release-cli) ![node-current (scoped)](https://img.shields.io/node/v/@tomjs/release-cli) ![NPM](https://img.shields.io/npm/l/@tomjs/release-cli)

[English](./README.md) | **中文**

> 一个自动化发布 `npm` 包的 `CLI` 工具.

## 注意

- 本工具学习和参考了优秀的 [np](https://github.com/sindresorhus/np) 和 [changesets](https://github.com/changesets/changesets)
- 本工具仅用于学习交流，不推荐他人重要项目使用，建议使用上述工具

## 特性

- 可选择或自定义 `npm` 版本号和 `dist-tag`
- 根据 `git` 信息自动生成 `changelog`
- 自动发布到 `https://registry.npmjs.org`
- 创建 github release 链接

## 条件

| 名称     | 版本    |
| -------- | ------- |
| **node** | >= 18   |
| **git**  | >= 2.11 |
| npm      | >= 7    |
| pnpm     | >= 8    |

## 安装

```bash
# pnpm
pnpm add @tomjs/release-cli -D

# yarn
yarn add @tomjs/release-cli -D

# npm
npm add @tomjs/release-cli -D
```

## 使用

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
  --scoped-tag          Use scoped package name as git tag
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

## 配置文件

你可以通过以下方式配置 `release-cli`（按优先顺序）：

- `package.json` 文件中的 "`rc`" 属性。
- `rc.config.json` 文件
- 使用 `export default` 或 `module.exports` 导出对象的 `rc.config.js` 文件（取决于 package.json 中的 type 值）。
- 使用 `export default` 导出对象的 `rc.config.mjs` 文件。
- 使用 `module.exports` 导出对象的 `rc.config.cjs` 文件。
