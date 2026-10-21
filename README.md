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
scripts/validate-marketplace.mjs  # structural linter (Node, no dependencies)
.github/workflows/validate.yml    # CI on every pull request
CODEOWNERS  CONTRIBUTING.md  MARKETPLACE-RESEARCH.md
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Quick check before a PR:

```sh
node scripts/validate-marketplace.mjs
claude plugin validate .
```

## License

[MIT](LICENSE)
