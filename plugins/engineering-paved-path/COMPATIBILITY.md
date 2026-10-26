# Compatibility

## Claude Code

Minimum: **>=2.1.110** — the version this marketplace requires for version-constrained
plugin dependencies (`"dependencies": [{ "name": …, "version": "^1.0.0" }]`). The skills use standard `SKILL.md`
frontmatter (`user-invocable`, `allowed-tools`).

## Dependencies

None. Depended on by `architecture-review` and `sdd-engineering` (`^1.0.0`).

Renaming or removing a skill, or a `RULES.md` digest, breaks agents that reference it by
name: that is a MAJOR release.

## Runtime

`typescript-expert/scripts/ts_diagnostic.py` needs Python 3; `pr-description/scripts/change-stats.sh`
needs bash 4+ and git (Git Bash on Windows). The `check-pr-body.sh` hook exits at once
unless `PR_DESCRIPTION_GH_HOST` is set; then it needs bash, git and Node.js 18+. Nothing else
in the plugin runs code.
