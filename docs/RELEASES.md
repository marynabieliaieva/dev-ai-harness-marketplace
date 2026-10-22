# Releases

## Versioning (SemVer)

Each plugin is versioned independently with `MAJOR.MINOR.PATCH` in its own
`.claude-plugin/plugin.json`:

- **MAJOR** — breaking: renamed/removed skill or agent, changed inputs/outputs, raised
  minimum Claude Code version, new required `userConfig`.
- **MINOR** — backward-compatible behavior or new components.
- **PATCH** — fixes with no behavior change for correct usage.

Rules:

- `version` lives **only** in `plugin.json`, never in the `marketplace.json` entry.
- **Bump it on every release.** Claude Code delivers a new copy only when the version
  string changes; commits pushed without a bump never reach users.
- Every release has a `CHANGELOG.md` entry with a `## [<version>] - <date>` heading
  ([Keep a Changelog](https://keepachangelog.com) layout, notes collected under
  `## [Unreleased]` until the bump). The structural lint fails when the entry for the
  version in `plugin.json` is missing.

## Tags

Dependency version ranges resolve against git tags named `<plugin>--v<version>`:

```text
engineering-paved-path--v1.0.0
sdd-engineering--v1.1.0
```

A tag points at a merged commit on `main` that passed CI and is **never moved or
deleted**. Tags are created by `scripts/release.mjs`, which runs the checks
`claude plugin tag` doesn't and then calls it:

| Check | Fails when |
|---|---|
| Git state | uncommitted changes, or `HEAD` is not `origin/main` |
| Version | the tag already exists (locally or on `origin`), or the version is not above the last released one |
| Changelog | no `CHANGELOG.md` heading for the version |
| Dependencies | an in-marketplace dependency has no released tag satisfying its range |
| Validation | `scripts/validate-marketplace.mjs`, `claude plugin validate .` or `claude plugin validate <plugin>` fails |

```sh
node scripts/release.mjs <plugin>          # dry run: all checks + claude plugin tag --dry-run
node scripts/release.mjs <plugin> --push   # create <plugin>--v<version> and push it
```

Set `CLAUDE_BIN` when `claude` isn't on `PATH`, e.g.
`CLAUDE_BIN="npx -y @anthropic-ai/claude-code@2.1.306"`.

**Tagging is automatic after merge.** `.github/workflows/release-tags.yml` runs
`scripts/tag-releases.mjs --push` on every push to `main` that touches `plugins/` or the
catalog: it finds each plugin whose `plugin.json` version has no tag and runs
`release.mjs --push` for it, dependencies first. A failed check stops the run and leaves
later plugins untagged; fix it on `main` and re-run the workflow (it is idempotent). Run
`node scripts/tag-releases.mjs` without `--push` to see what the next merge would release.

## Release checklist

1. Release dependencies first, then the plugins that depend on them. One PR may carry
   both: the workflow tags dependencies before dependents.
2. On a branch: bump `version`, move the `## [Unreleased]` notes under the new version
   heading in `CHANGELOG.md` (and update `COMPATIBILITY.md` if the minimum Claude Code
   version changed).
3. Run validation and the plugin's evals (old and new).
4. Merge to `main`. CI tags the release; check the **Tag plugin releases** run.

## Updating (consumers)

```sh
claude plugin marketplace update dev-digest-ai-marketplace
claude plugin update <plugin>@dev-digest-ai-marketplace --scope project
```

Then start a new session or run `/reload-plugins`. Updating the catalog and updating a
plugin are separate steps. Auto-update is off by default; users enable it under
`/plugin` → **Marketplaces**, or an admin sets `autoUpdate` in managed settings.

## Release channels

Claude Code has no channel concept, and one marketplace serves one version of a plugin.
Channels are separate marketplaces with **different `name`s** whose entries pin
different refs:

| Channel | Marketplace name | Catalog | Entry source |
|---|---|---|---|
| latest | `dev-digest-ai-marketplace` | `.claude-plugin/marketplace.json` | `main` of this repo |
| stable | `dev-digest-ai-marketplace-stable` | [`channels/stable/.claude-plugin/marketplace.json`](../channels/stable/.claude-plugin/marketplace.json) | `git-subdir` pinned to a release tag (`ref`) and its commit (`sha`) |

Users choose a channel by which marketplace they add:

```sh
# latest
claude plugin marketplace add marynabieliaieva/dev-ai-harness-marketplace --scope project
# stable
claude plugin marketplace add https://raw.githubusercontent.com/marynabieliaieva/dev-ai-harness-marketplace/main/channels/stable/.claude-plugin/marketplace.json --scope project
```

The stable catalog lists **every** plugin, because a bare dependency name resolves inside
the same marketplace. CI validates it (`claude plugin validate channels/stable`).

### Maintainers: move the stable channel

Stable moves only to a release that passed its evals and a smoke run from `latest`. In a
PR, change the plugin's entry in `channels/stable/.claude-plugin/marketplace.json`:

- `ref` → the release tag, e.g. `sdd-engineering--v1.1.0`;
- `sha` → the commit that tag points to: `git rev-parse <tag>^{commit}`.

Never point stable at a branch. Consumers on stable get the new pin with
`claude plugin marketplace update dev-digest-ai-marketplace-stable` and
`claude plugin update <plugin>@dev-digest-ai-marketplace-stable`.

## Rollback

There is **no** `plugin rollback` command, and history is never rewritten. A rollback is
a new PATCH release whose content is an earlier release.

### Maintainers: ship the good version again

```sh
node scripts/rollback.mjs <plugin> <good-version> --dry-run
node scripts/rollback.mjs <plugin> <good-version> --reason "<what broke>"
```

The script restores `plugins/<plugin>/` from the `<plugin>--v<good-version>` tag
(files added since are removed), keeps the current `CHANGELOG.md` and adds a
`### Reverted` entry, sets `version` to the next PATCH (`2.0.0` → `2.0.1`), runs the
structural lint and stages the result. Commit it on a branch, open a PR, and after merge
CI tags the new version. Consumers then get it with a normal update:

```sh
claude plugin marketplace update dev-digest-ai-marketplace
claude plugin update <plugin>@dev-digest-ai-marketplace --scope project
```

The rollback keeps the bad version's MAJOR/MINOR numbers. If dependents pinned a range
that only the bad version satisfied, release a fixed version instead of rolling back.

### Consumers: switch to the stable channel

To return a consumer to a verified version before the fix is released. Use the scope the
plugin was installed in (`claude plugin list` shows it); the examples use `project`.

1. Leave `latest`. `--prune -y` also removes the dependencies it auto-installed, so the
   same agents and skills aren't loaded twice from two channels; `--keep-data` keeps the
   plugin's data directory (`~/.claude/plugins/data/<id>/`):
   ```sh
   claude plugin uninstall <plugin>@dev-digest-ai-marketplace --scope project --keep-data --prune -y
   ```
2. Install from `stable`; its dependencies come from the same catalog:
   ```sh
   claude plugin marketplace add https://raw.githubusercontent.com/marynabieliaieva/dev-ai-harness-marketplace/main/channels/stable/.claude-plugin/marketplace.json --scope project
   claude plugin install <plugin>@dev-digest-ai-marketplace-stable --scope project
   claude plugin list --json   # version and gitCommitSha match the stable pins
   ```
3. `/reload-plugins` or a new session, then run the plugin's smoke eval.
4. Return to `latest` only after the fix is released and verified:
   ```sh
   claude plugin uninstall <plugin>@dev-digest-ai-marketplace-stable --scope project --keep-data --prune -y
   claude plugin marketplace remove dev-digest-ai-marketplace-stable
   claude plugin install <plugin>@dev-digest-ai-marketplace --scope project
   ```
   If the bad version changed external state, document how to restore it in the incident
   notes.

**Plugin data and external state of this marketplace's plugins.** No plugin here uses a
persistent data directory (`${CLAUDE_PLUGIN_DATA}`), so switching channels loses nothing.
`sdd-engineering` writes only project files — `specs/`, `docs/plans/`, `docs/retro/ledger/`,
`INSIGHTS.md` — which stay in the repository and stay readable across 1.x: 1.1.0 adds
`AC missing:` entries inside the existing `[NEEDS CLARIFICATION]` section, which 1.0.0
also treats as open items.

### Rehearsal: `sdd-engineering` 1.1.0 → stable 1.0.0 → latest

Run in the consumer project after `sdd-engineering--v1.1.0` is tagged. Stable pins
`sdd-engineering` to `1.0.0` until 1.1.0 has been verified.

| Step | Commands | Check |
|---|---|---|
| Update to 1.1.0 | `claude plugin marketplace update dev-digest-ai-marketplace`<br>`claude plugin update sdd-engineering@dev-digest-ai-marketplace --scope project` | `claude plugin list --json` → `sdd-engineering` `1.1.0` |
| Reload | `/reload-plugins` or a new session | — |
| Smoke 1.1.0 | `claude --agent sdd-engineering:spec-creator` with a requirement that has no facts (e.g. "must be rate-limited", no numbers) | spec stays `draft` with `AC missing:`; the reply starts `Spec INCOMPLETE`; `implementation-planner` refuses it |
| Roll back | steps 1–2 of "switch to the stable channel" above | `sdd-engineering` `1.0.0`, deps at their stable pins |
| Smoke 1.0.0 | `/reload-plugins`, then the same `spec-creator` run | no `Spec INCOMPLETE` gate (1.0.0 behaviour); specs written under 1.1.0 still open |
| Back to latest | step 4 above | `sdd-engineering` `1.1.0` again |

There is no `claude plugin rollback`; the rehearsal uses only `uninstall`, `marketplace
add`/`remove` and `install`.

For a catalog entry change (not plugin content), revert it on `main` in a PR — don't
rewrite history. See [SECURITY.md](SECURITY.md#after-an-unsafe-release)
for unsafe releases.
