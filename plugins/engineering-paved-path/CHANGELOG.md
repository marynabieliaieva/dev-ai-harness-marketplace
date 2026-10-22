# Changelog

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com),
versions: [SemVer](https://semver.org) — see [docs/RELEASES.md](../../docs/RELEASES.md).

## [Unreleased]

## [1.0.1] - 2026-10-22

### Fixed

- `zod`: the description no longer points to `react-hook-form` and `orval` skills, which
  don't exist in this marketplace; it names what the skill doesn't cover instead.

## [1.0.0] - 2026-10-21

### Added

- Twelve technical skills from the DevDigest harness: `security`, `typescript-expert`,
  `zod`, `react-best-practices`, `next-best-practices`, `react-testing-library`,
  `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`,
  `mermaid-diagram`, `onion-architecture`, `frontend-ui-architecture`.
- `onion-architecture` 1.1.0 and `frontend-ui-architecture` 1.1.0: DevDigest paths became a
  reference layout that the project's own layer map overrides.
- `skill-routing`: the file → skill map for authoring and review agents, with a project
  template; the default map is role-based (frontend package, backend package, Drizzle
  files) instead of fixed folder names.
- Project-specific names removed from the skills: port and service names, hook-file
  examples and secret/untrusted-content examples are generic.
- Upstream `LICENSE` files in the folders of the MIT-licensed skills, and a Credits table.
