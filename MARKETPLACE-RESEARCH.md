# Marketplace research

Summary of the official Claude Code documentation and community practice used to set up
this repository (October 2026, Claude Code 2.1.306). The rules that matter day to day are
in [docs/](docs/); this file records where they come from.

## Official requirements

- A marketplace is a directory/repo with `.claude-plugin/marketplace.json`. Required:
  `name`, `owner.name`, `plugins[]`; each entry needs `name` and `source`.
- Relative `source` resolves from the repo root (the directory containing
  `.claude-plugin/`), must start with `./`, no `..`, forward slashes only. Relative paths
  work only when the marketplace is added via git/directory, not via a bare
  `marketplace.json` URL.
- Entry `name` must equal the plugin's `plugin.json` `name`: the entry name is the
  install id, the manifest name is the component namespace.
- Plugin layout: only `plugin.json` goes in `.claude-plugin/`; `skills/`, `agents/`,
  `commands/`, `hooks/hooks.json`, `.mcp.json` sit at the plugin root. A `CLAUDE.md` in
  a plugin is not loaded.
- Installs copy plugins into a cache; references outside the plugin dir break. Symlinks
  inside the marketplace are dereferenced; symlinks outside it are skipped.
- `${CLAUDE_PLUGIN_ROOT}` (changes per update), `${CLAUDE_PLUGIN_DATA}` (persistent),
  `${CLAUDE_PROJECT_DIR}`.
- Versions: users get a new copy only when the computed version changes. Either bump
  `version` every release or omit it to track commits. Don't set it in both
  `plugin.json` and the entry (`plugin.json` wins).
- Plugin names are immutable; use `displayName` to relabel, `renames` (append-only) to
  migrate, `forceRemoveDeletedPlugins` to uninstall removed plugins.
- Reserved names: official marketplace names (`claude-plugins-official`,
  `agent-skills`, …), impersonations, `npm`/`github`/…; plugin names starting with
  `claude-`, `anthropic-`, `cc-plugin-`.
- Private repos: Claude Code runs non-interactive `git` with the user's credentials,
  probing SSH first for `owner/repo`. `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips the probe.
  No marketplace field carries credentials.
- Auto-update is off by default; users or admins (`extraKnownMarketplaces.autoUpdate`)
  turn it on.
- Release channels = separate marketplaces with different `name`s pinning different
  refs. There is no rollback command.
- No Git LFS (clones don't fetch it); no top-level `bin/` if the marketplace may be
  synced through claude.ai organization settings.
- `claude plugin validate <path>` checks JSON, required fields, names, `..` paths and
  each relative plugin's manifest; `--strict` turns warnings into failures. It does not
  catch missing source directories or remote-source errors — those surface at install.

## Community practice

- Anthropic's own `claude-plugins-official`: `plugins/` (internal) vs
  `external_plugins/` (third-party), a README per plugin, a reference example plugin,
  Apache-2.0 license, `renames` for label changes.
- CI validation on every PR that touches plugin definitions; same checks runnable
  locally.
- External plugin sources pinned by commit `sha` rather than moving tags; automated PRs
  bump the pin when upstream moves.
- Version/changelog consistency checks in CI.

## Sources

- [Create a marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
- [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace)
- [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference)
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
- [claude-plugins-community CI overview](https://instagit.com/anthropics/claude-plugins-community/what-is-ci-cd-workflow-for-validating-claude-plugins/) (third-party summary)
