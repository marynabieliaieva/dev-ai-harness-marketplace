# Contributing

This repository is a Claude Code plugin marketplace: one catalog
(`.claude-plugin/marketplace.json`) plus the plugins under `plugins/`. A change here
reaches every consumer on their next update, so keep changes small and reviewable.

## Where things go

| You are... | Edit |
|---|---|
| Adding a plugin | `plugins/<name>/` + one entry in `.claude-plugin/marketplace.json` + a line in `CODEOWNERS` + a row in `README.md` |
| Changing a plugin | Files under `plugins/<name>/`, a `version` bump in its `plugin.json`, a `CHANGELOG.md` entry — CI tags the release after merge ([RELEASES.md](docs/RELEASES.md)) |
| Rolling a plugin back | `node scripts/rollback.mjs <name> <good-version>`, then a PR ([RELEASES.md](docs/RELEASES.md#rollback)) |
| Changing catalog metadata | `.claude-plugin/marketplace.json` only |
| Changing rules or CI | `docs/`, `scripts/`, `.github/` — needs a catalog owner's review |

Plugin layout, manifest fields and dependency rules:
[docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md). Secrets, paths and permissions:
[docs/SECURITY.md](docs/SECURITY.md). Versions, tags and rollback:
[docs/RELEASES.md](docs/RELEASES.md).

## Changing the catalog safely

- **Entry `name` = `plugin.json` `name`.** The entry name is the install id
  (`<name>@dev-digest-ai-marketplace`); a mismatch breaks installs.
- **Never rename or delete an entry silently.** Users' settings reference the name.
  Change `displayName` to relabel. If a rename or removal is unavoidable, add the old name
  to `renames` (`"old": "new"` or `"old": null`) — append-only, never edit past entries.
- **`source` is a path from the repo root**: starts with `./`, forward slashes, no `..`.
- **No `version` in catalog entries** — it lives in `plugin.json` only.
- **One plugin per PR** where possible; catalog-wide changes go in their own PR.
- Don't change the marketplace `name` — every consumer's install ids depend on it.

## Checks

Run before pushing (CI runs the same on every pull request):

```sh
node scripts/validate-marketplace.mjs     # structure, names, paths, secrets, dependencies
claude plugin validate .                  # official catalog validation
claude plugin validate ./plugins/<name>   # official plugin validation
```

Then load the plugin and exercise its scenario and evals:

```sh
claude --plugin-dir ./plugins/<name>
```

Add a `--plugin-dir` for each dependency as well; a plugin whose dependencies are missing is
disabled (`dependency-unsatisfied`).

Full install loop from your working copy:

```sh
claude plugin marketplace add ./
claude plugin install <name>@dev-digest-ai-marketplace
```

## Pull requests

Fill in the [PR template](.github/pull_request_template.md) checklist. A PR needs a green
CI run and approval from the [CODEOWNERS](CODEOWNERS) of every touched path.
