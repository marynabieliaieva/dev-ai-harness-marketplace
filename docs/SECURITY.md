# Security policy

Plugins run on the consumer's machine with the consumer's permissions: hooks execute
shell commands, MCP servers open network connections, agents get tools. Treat every
change to this repository as code that runs on other people's computers.

## Secrets

- **No secrets in the repository** — not in manifests, hooks, MCP configs, skills,
  examples or tests. `scripts/validate-marketplace.mjs` scans plugin files for common
  token formats (GitHub, Anthropic, OpenAI, AWS, Slack, private keys) and fails CI.
- A value the user must supply goes into `userConfig` in `plugin.json`; mark credentials
  `"sensitive": true` so they land in the OS credential store, not `settings.json`.
- Reference it as `${user_config.KEY}` in MCP/LSP config or exec-form hook `args`, or read
  `CLAUDE_PLUGIN_OPTION_<KEY>` in a hook. Shell-form hooks can't take `${user_config.*}`.
- The marketplace has no field for git credentials and must never carry one.

## Paths

- No absolute paths (`C:\Users\...`, `/Users/...`, `/home/...`) — checked by the linter.
- No `..` escapes out of the plugin directory. Use `${CLAUDE_PLUGIN_ROOT}`,
  `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_DATA}` (see
  [PLUGIN-GUIDELINES.md](PLUGIN-GUIDELINES.md)).

## Permissions

- **Agents:** grant the minimum `tools`. Read-only agents (researchers, reviewers,
  verifiers) get no `Write`/`Edit`. Justify `Bash` in the PR.
- **Hooks:** every hook script is reviewed line by line. Prefer exec form with `args`;
  in shell form quote every substituted path. Hooks must not download or execute remote
  code, change git config, or touch files outside the project / `${CLAUDE_PLUGIN_DATA}`.
- **MCP / network:** optional integrations only, documented in the plugin README with the
  hosts they contact. Use `https://`; no `http://` to non-loopback hosts.
- **Scripts:** no `curl | sh`, no `eval` of fetched content, no `sudo`, no writes outside
  the project or plugin data dir. Executables live in `scripts/`, never a top-level `bin/`.
- No Git LFS for plugin files — clones don't fetch LFS content.

## Review

Changes to `hooks/`, `scripts/`, `.mcp.json`, agent `tools` or `userConfig` need approval
from a [CODEOWNERS](../CODEOWNERS) owner, and the PR must say what runs, when, and with
which access.

## After an unsafe release

1. **Stop distribution.** Revert the catalog entry to the last safe version (pin `ref`/`sha`
   or revert the `version` bump) — or remove the entry, map it to `null` in `renames`, and
   set `"forceRemoveDeletedPlugins": true` so it is uninstalled from users' machines.
2. **Rotate** any exposed credential immediately; deleting the commit is not enough —
   history and clones keep it.
3. **Tell consumers** what was affected, which versions, and the exact commands to update
   or roll back (see [RELEASES.md](RELEASES.md#rollback)).
4. **Fix forward** with a new PATCH release; never move or reuse an existing tag.
5. Record the incident and the rule that would have caught it in this file or the linter.

## Reporting a vulnerability

Do not open a public issue. Contact the owners listed in [CODEOWNERS](../CODEOWNERS)
privately (GitHub security advisory on this repository).
