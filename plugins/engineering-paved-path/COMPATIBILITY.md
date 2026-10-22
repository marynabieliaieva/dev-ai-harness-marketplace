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

`typescript-expert/scripts/ts_diagnostic.py` needs Python 3; nothing else in the plugin runs
code.
