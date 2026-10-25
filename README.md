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
| [sdd-engineering](plugins/sdd-engineering) | Spec Driven Development: spec-creator, implementation-planner, implementer, plan-verifier, `/sdd-engineering:run-plan`, `/sdd-engineering:workflow-retro` |
| [research-tools](plugins/research-tools) | Read-only `researcher` agent with cited repository and web research |
| [architecture-review](plugins/architecture-review) | Read-only `architecture-reviewer` against the project’s own boundary rules |
| [engineering-paved-path](plugins/engineering-paved-path) | Shared technical skills (architecture, security, TypeScript, React/Next.js, Fastify, Drizzle, Postgres, Zod) and skill routing |
| [flaky-fix](plugins/flaky-fix) | Flaky test triage with no extra pipeline runs: scripts, read-only investigator and critic agents, a guard hook; `/flaky-fix:flaky-fix` |

Dependencies between them (installing a plugin enables what it depends on):

```text
sdd-engineering ──► research-tools
       │        ──► architecture-review ──► engineering-paved-path
       └──────────────────────────────────► engineering-paved-path
```

## Repository layout

```text
.claude-plugin/marketplace.json   # the catalog (latest channel): name, owner, plugins[]
channels/stable/                  # stable channel catalog, pinned to release tags (docs/RELEASES.md)
plugins/<name>/                   # one directory per plugin
docs/
  PLUGIN-GUIDELINES.md            # plugin structure, manifest, dependencies
  SECURITY.md                     # secrets, paths, permissions, unsafe-release response
  RELEASES.md                     # SemVer, tags, update, channels, rollback
  SITE-SPEC.md                    # catalog site: routes, index format, search, safety
  temp/                           # working notes, deleted once they've served their purpose
evals/                            # content/workflow eval engine for plugin skills and agents (vitest + Agent SDK)
scripts/validate-marketplace.mjs  # structural linter (Node, no dependencies)
scripts/release.mjs, rollback.mjs # release preflight + tag, rollback as a new PATCH
scripts/tag-releases.mjs          # tags untagged versions after merge (release-tags.yml)
scripts/build-index.mjs           # catalog data for the site (index, releases, stats, feed, bodies)
site/                             # catalog website for GitHub Pages (React + TypeScript + Vite)
.github/workflows/validate.yml    # "Harness validation" check on every pull request
.github/workflows/site.yml        # "Catalog site build" check on every pull request
.github/workflows/pages.yml       # builds and deploys site/dist to GitHub Pages
CODEOWNERS  CONTRIBUTING.md
```

## Catalog website

`site/` is a React + TypeScript + Vite catalog for GitHub Pages: search over every plugin,
skill, agent, command, hook and MCP server (MiniSearch, in the browser), plugin and
component pages with rendered documentation, install commands, a trust summary per
plugin, an install builder and a release feed. Specification:
[docs/SITE-SPEC.md](docs/SITE-SPEC.md).

`scripts/build-index.mjs` generates the data from the repository into `site/public/`
(`index.json`, `releases.json`, `stats.json`, `feed.xml`, `bodies/`). Generated
files and `site/dist/` are not committed. Run it locally:

```sh
npm run build:index
cd site && npm ci && npm run build && npm run preview   # http://localhost:4173
```

(`npm run dev` in `site/` for live reload.) It uses relative URLs and hash routes, so
GitHub Pages serves it from the repository subpath
(`https://marynabieliaieva.github.io/dev-ai-harness-marketplace/`) as is.
`.github/workflows/site.yml` builds the index and the site on every pull request as its own
check, **Catalog site build**, separate from **Harness validation** (`validate.yml`);
`.github/workflows/pages.yml` repeats the build on every push to `main` that touches
`site/`, `plugins/` or the catalog, and publishes `site/dist`. One-time setup:
**Settings → Pages → Source: GitHub Actions**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Quick check before a PR:

```sh
node scripts/validate-marketplace.mjs
claude plugin validate .
```

## License

[MIT](LICENSE)
