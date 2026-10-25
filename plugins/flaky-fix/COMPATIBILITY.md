# Compatibility

## Claude Code

Minimum: **>=2.1.110**, the marketplace-wide minimum.

| Feature | Needed for |
|---|---|
| Skill `disallowed-tools` | removing web, notebook and skill tools while the orchestrator runs |
| PreToolUse `permissionDecision: "ask"` | the four user prompts before outward actions |
| Hook matchers as regex (`mcp__.*`) | guarding every MCP tool |

Not supported: `bypassPermissions` and headless `-p` runs (hook `ask` behaviour there is not
documented).

## Runtime

Node.js 22+ and git on `PATH`. A Jira MCP server (create issue, transition) and,
optionally, a GitHub MCP server (create pull request).

Run artifact format: `.flaky/<run>/` files as listed in the README. A change to them or to
the stage list in `scripts/lib/run.mjs` is a MAJOR release.
