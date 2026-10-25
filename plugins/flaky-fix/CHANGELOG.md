# Changelog

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com),
versions: [SemVer](https://semver.org) — see [docs/RELEASES.md](../../docs/RELEASES.md).

## [Unreleased]

## [1.0.0] - 2026-10-25

### Added

- `/flaky-fix:flaky-fix`: user-only orchestrator from test name, stack trace, date and
  failure rate to Jira issue, fix branch, reviewed commit and PR, with no test or pipeline
  runs.
- Scripts `intake`, `scope`, `candidates`, `validate`, `branch`, `commit`, `push`, `state`
  owning the run state in `.flaky/<run>/`.
- Read-only agents `flaky-investigator` and `fix-critic`; reference skill `flaky-patterns`.
- `guard.mjs` PreToolUse hook: blocks test/CI/network/raw-git commands during a run, confines
  edits by stage and scope, allows four MCP writes with a user prompt and denies the rest. A PR
  may only target origin's owner/repo, from the run's branch, into its base.
- The run always works on the latest code: `intake` fetches origin and fast-forwards the
  default branch (refuses on another branch, a dirty tree or unpushed commits); `branch`
  fetches again and reports scope files changed since the analysis.
