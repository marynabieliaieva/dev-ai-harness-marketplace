# Changelog

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com),
versions: [SemVer](https://semver.org) — see [docs/RELEASES.md](../../docs/RELEASES.md).

## [Unreleased]

## [1.0.0] - 2026-10-21

### Added

- Agent `architecture-reviewer`, extracted from the DevDigest harness and generalized: it
  builds a rule profile from the project's `CLAUDE.md`/`AGENTS.md`, applies the onion and
  frontend rule sets only where the project declares them, adds P1 for project-stated
  rules, and runs the project's own architecture check if one exists.
