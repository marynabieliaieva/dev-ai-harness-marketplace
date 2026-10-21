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
- Every release has a `CHANGELOG.md` entry.

## Tags

Dependency version ranges resolve against git tags named `<plugin>--v<version>`:

```text
engineering-paved-path--v1.0.0
sdd-engineering--v1.1.0
```

Create them from the plugin's directory:

```sh
claude plugin tag --dry-run
claude plugin tag --push
```

A tag points at a commit that passed CI and is **never moved or deleted**.

## Release checklist

1. Release dependencies first, then the plugins that depend on them.
2. Bump `version`, update `CHANGELOG.md` (and `COMPATIBILITY.md` if the minimum
   Claude Code version changed).
3. Run validation and the plugin's evals (old and new).
4. Merge to `main`, then tag the merge commit.

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

There is **no** `plugin rollback` command. To return a consumer to a verified version:

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

For the whole catalog, revert the entry or the version bump on `main` and release a new
PATCH — don't rewrite history. See [SECURITY.md](SECURITY.md#after-an-unsafe-release)
for unsafe releases.
