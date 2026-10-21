# dev-digest-ai-marketplace

Claude Code plugin marketplace for the DevDigest AI-engineering harness: reusable
skills, agents, hooks and SDD workflows, extracted from DevDigest so they can be
installed into any project and released on their own cadence.

## Install

Add the marketplace (in a Claude Code session):

```
/plugin marketplace add marynabieliaieva/dev-ai-harness-marketplace
```

Install a plugin by `<plugin>@dev-digest-ai-marketplace`:

```
/plugin install <plugin>@dev-digest-ai-marketplace
```

To share it with everyone working in a project, run once there and commit the
`.claude/settings.json` it writes:

```sh
claude plugin marketplace add marynabieliaieva/dev-ai-harness-marketplace --scope project
claude plugin install <plugin>@dev-digest-ai-marketplace --scope project
```

> **No GitHub SSH key?** Claude Code tries SSH first. Set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`
> and store an HTTPS credential (`gh auth login && gh auth setup-git`); otherwise installs
> from `/plugin` and background updates fail for a private repository.

Update: `claude plugin marketplace update dev-digest-ai-marketplace`, then
`claude plugin update <plugin>@dev-digest-ai-marketplace`. See
[docs/RELEASES.md](docs/RELEASES.md).

## Plugins

| Plugin | Description |
|---|---|
| _none yet_ | |

## Repository layout

```text
.claude-plugin/marketplace.json   # the catalog: name, owner, plugins[]
plugins/<name>/                   # one directory per plugin
docs/
  PLUGIN-GUIDELINES.md            # plugin structure, manifest, dependencies
  SECURITY.md                     # secrets, paths, permissions, unsafe-release response
  RELEASES.md                     # SemVer, tags, update, channels, rollback
  temp/                           # working notes, deleted once they've served their purpose
scripts/validate-marketplace.mjs  # structural linter (Node, no dependencies)
scripts/release.mjs, rollback.mjs # release preflight + tag, rollback as a new PATCH
scripts/tag-releases.mjs          # tags untagged versions after merge (release-tags.yml)
site/                             # catalog website for GitHub Pages (static, no build step)
.github/workflows/validate.yml    # CI on every pull request
.github/workflows/pages.yml       # deploys site/ to GitHub Pages
CODEOWNERS  CONTRIBUTING.md
```

## Catalog website

`site/` is a static search page over every plugin, skill, agent, command, hook and MCP
server in the catalog, with install commands, a trust summary per plugin, an install
builder and a release feed. It reads `site/public/index.json` (generated in CI, not
committed) and falls back to `site/public/index.sample.json`, which also documents the
index format. Preview it locally:

```sh
node site/serve.mjs   # http://localhost:4173
```

The site is a self-contained project: everything it needs lives in `site/`, kept apart
from the marketplace itself (`plugins/`, `.claude-plugin/`). It uses only relative URLs
and hash routes, so GitHub Pages serves it from the repository subpath
(`https://marynabieliaieva.github.io/dev-ai-harness-marketplace/`) as is.
`.github/workflows/pages.yml` deploys it on every push to `main` that touches `site/`,
`plugins/` or the catalog. One-time setup: **Settings → Pages → Source: GitHub Actions**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Quick check before a PR:

```sh
node scripts/validate-marketplace.mjs
claude plugin validate .
```

## License

[MIT](LICENSE)
