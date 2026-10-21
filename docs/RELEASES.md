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

| Channel | Marketplace name | Entry source |
|---|---|---|
| latest | `dev-digest-ai-marketplace` | `main` of this repo |
| stable | `dev-digest-ai-marketplace-stable` | `ref`/`sha` of the last verified release |

Users choose a channel by which marketplace they add (or `#<ref>` on the add command).

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

> The stable channel is not set up yet; until it is, consumers wait for the rollback
> release above.

To return a consumer to a verified version before the fix is released:

1. Remove the current plugin (and channel if needed):
   ```sh
   claude plugin uninstall <plugin>@dev-digest-ai-marketplace --scope project --keep-data
   ```
2. Install from the stable channel, whose catalog pins the verified release by `ref`/`sha`:
   ```sh
   claude plugin marketplace add <stable-marketplace-source> --scope project
   claude plugin install <plugin>@dev-digest-ai-marketplace-stable --scope project
   ```
   A marketplace is identified by its `name`, so the stable catalog must not reuse
   `dev-digest-ai-marketplace`.
3. `/reload-plugins` or a new session, then run the plugin's smoke eval.
4. Return to `latest` only after the fix is released and verified. If the bad version
   changed external state, document how to restore it in the incident notes.

For a catalog entry change (not plugin content), revert it on `main` in a PR — don't
rewrite history. See [SECURITY.md](SECURITY.md#after-an-unsafe-release)
for unsafe releases.
