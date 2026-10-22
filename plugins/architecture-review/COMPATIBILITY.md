# Compatibility

## Claude Code

Minimum: **>=2.1.110** — the version this marketplace requires for version-constrained
plugin dependencies (`"dependencies": [{ "name": …, "version": "^1.0.0" }]`). The agent uses standard subagent
frontmatter (`tools`, `disallowedTools`, `model`).

## Dependencies

| architecture-review | engineering-paved-path |
|---|---|
| 1.x | ^1.0.0 |

Depended on by `sdd-engineering` (`^1.0.0`). The finding format (fields, rule ids,
`ARCHITECTURE_CLEAN`) is part of the contract `run-plan` parses: changing it is a MAJOR
release.
