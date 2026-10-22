# Plugin guidelines

How a plugin in this marketplace is laid out, what its manifest must contain, and how it
depends on other plugins. `scripts/validate-marketplace.mjs` enforces the rules marked
**(checked)**; the rest are enforced in review.

## Layout

```text
plugins/<name>/
├── .claude-plugin/
│   └── plugin.json        # manifest — the ONLY file inside .claude-plugin/ (checked)
├── skills/<skill>/SKILL.md
├── agents/<agent>.md
├── commands/<command>.md  # prefer skills/ for new work
├── hooks/hooks.json
├── scripts/               # executables for hooks/MCP — never a top-level bin/ (checked)
├── evals/                 # behavior evals for the plugin's scenarios
├── .mcp.json              # optional integrations only, see SECURITY.md
├── README.md              # (checked)
├── CHANGELOG.md           # (checked)
└── COMPATIBILITY.md       # minimum Claude Code version and why
```

- Component folders live at the plugin root, not inside `.claude-plugin/`.
- A `CLAUDE.md` inside a plugin is **not** loaded into context (checked). Put instructions
  in a skill.
- Installs copy the plugin into a cache. A plugin must not reference anything outside its
  own directory except through a declared dependency (checked: no `..` escapes).

## Manifest (`.claude-plugin/plugin.json`)

| Field | Required | Notes |
|---|---|---|
| `name` | yes (checked) | kebab-case, equal to the `marketplace.json` entry name (checked). Immutable once released |
| `version` | yes (checked) | SemVer `MAJOR.MINOR.PATCH`. Set it **only** here, never in the catalog entry (checked) |
| `description` | yes (checked) | One line, shown in `/plugin` |
| `author` | yes (checked) | `{ "name": ... }` — the owning team |
| `license` | yes | SPDX id |
| `keywords` | recommended | Used for discovery and catalog search |
| `dependencies` | when needed | See below |
| `displayName` | optional | Change this, not `name`, to relabel a plugin |

Names must not start with `claude-`, `anthropic-` or `cc-plugin-` (checked).

## Paths inside a plugin

| Variable | Use for |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | Files bundled with the plugin (hooks, MCP configs). Changes on every update — never write state there |
| `${CLAUDE_SKILL_DIR}` | Scripts and references inside one skill's folder |
| `${CLAUDE_PLUGIN_DATA}` | Persistent state, caches, installed `node_modules` |
| `${CLAUDE_PROJECT_DIR}` | The consumer's project root |

Quote them in shell-form hook commands: `"${CLAUDE_PLUGIN_ROOT}"/scripts/check.sh`.
Never hardcode absolute or product-specific paths (checked for absolute paths).

## Dependencies

- Declare in `plugin.json`:
  ```json
  "dependencies": [{ "name": "engineering-paved-path", "version": "^1.0.0" }]
  ```
- A bare name resolves against this marketplace; it must be an entry in the catalog
  (checked). Cross-marketplace dependencies need `allowCrossMarketplaceDependenciesOn`.
- Version ranges resolve against git tags `<plugin>--v<version>`, so every release of a
  dependency must be tagged (see [RELEASES.md](RELEASES.md)).
- No dependency cycles (checked).
- Reference components of a dependency by their namespaced name:
  `research-tools:researcher`, `engineering-paved-path:react-best-practices`.
- Shared skills have one home (`engineering-paved-path`); don't copy them into other plugins.

## What belongs in a plugin

Before adding a file, be able to name its owner, its consumer scenario, and why it is
released together with the rest of the plugin. Keep out:

- project-specific instructions, product specs and module names;
- local leftovers: caches, personal memory, experiments;
- integrations that need network access or credentials, unless the plugin exists for
  them — then follow [SECURITY.md](SECURITY.md).

## Before opening a PR

```sh
node scripts/validate-marketplace.mjs
claude plugin validate .
claude plugin validate ./plugins/<name>
claude --plugin-dir ./plugins/<name>     # load it and exercise the scenario
```

A plugin with dependencies needs them loaded too — add one `--plugin-dir` per dependency
(transitively). Without them Claude Code disables the plugin as `dependency-unsatisfied`,
so none of its components exist in the session. For the same reason run
`claude plugin eval` against the installed plugin (`<name>@dev-digest-ai-marketplace`), not
its directory.
