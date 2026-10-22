# Changelog

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com),
versions: [SemVer](https://semver.org) — see [docs/RELEASES.md](../../docs/RELEASES.md).

## [Unreleased]

## [1.1.0] - 2026-10-22

### Added

- `spec-creator`: an acceptance-criteria coverage gate. Every mandatory requirement (each
  Goal, user story, behaviour-constraining NFR and stated "must") needs at least one AC. A
  requirement it can't cover without inventing facts is kept, recorded as
  `AC missing: …` under `[NEEDS CLARIFICATION]`, and the final message starts with
  `Spec INCOMPLETE: …`. `implementation-planner` already refuses a spec with open
  `[NEEDS CLARIFICATION]` items, so such a spec does not move on.
- Behavior eval `spec-creator-requires-ac-per-requirement`.

Backward compatible: the spec format is unchanged; `AC missing:` entries use the existing
`[NEEDS CLARIFICATION]` section.

## [1.0.0] - 2026-10-21

### Added

- Agents `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`, extracted
  from the DevDigest harness and generalized: check commands come from the project (recorded
  in the plan's `Check commands`), skills come from `engineering-paved-path:skill-routing`,
  researchers are `research-tools:researcher`.
- Skill `/sdd-engineering:run-plan` — wave execution, verification and architecture-review
  loops, final full run, optional `--review`.
- Skill `/sdd-engineering:workflow-retro` with its ledger template and transcript parser.
- Skill `engineering-insights`, filing into the touched package's `INSIGHTS.md`.
- `PreToolUse` path guard for `spec-creator` and `implementation-planner`, keyed on
  `agent_type` (replaces the per-agent frontmatter hooks, which plugin agents don't support).
- Behavior evals for `claude plugin eval`.

### Removed (compared with the DevDigest harness)

- `--docs` in `run-plan` and `test-writer` task handling: `doc-writer` and `test-writer` are
  not part of this release. Implementer tasks now own the tests their ACs need.
