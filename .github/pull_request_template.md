## What and why

<!-- Which plugin(s) / catalog parts change, and the consumer scenario this serves. -->

## Checklist

### Every PR
- [ ] `node scripts/validate-marketplace.mjs` passes
- [ ] `claude plugin validate .` passes
- [ ] No secrets, tokens or absolute paths ([SECURITY.md](../docs/SECURITY.md))
- [ ] No `CLAUDE.md`, caches, personal memory or project-specific paths inside plugins

### Plugin added or changed
- [ ] `claude plugin validate ./plugins/<name>` passes
- [ ] Entry `name` in `marketplace.json` equals `name` in `plugin.json`
- [ ] `version` bumped in `plugin.json` only (SemVer — [RELEASES.md](../docs/RELEASES.md))
- [ ] `CHANGELOG.md` updated; `COMPATIBILITY.md` updated if the minimum Claude Code version changed
- [ ] Dependencies declared with version ranges; dependency releases are tagged `<plugin>--v<version>`
- [ ] Loaded with `claude --plugin-dir` and the scenario / evals run
- [ ] New plugin: `CODEOWNERS` line and `README.md` row added

### Security-sensitive (hooks, scripts, MCP, agent tools, userConfig)
- [ ] Describes what runs, when, and with which file/network access
- [ ] Agents have the minimum `tools`; credentials go through `userConfig` with `sensitive: true`

### Catalog changes
- [ ] No plugin renamed/removed without a `renames` entry
- [ ] Marketplace `name` unchanged
