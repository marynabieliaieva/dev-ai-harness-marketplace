# Catalog site — specification

A static catalog of the marketplace on GitHub Pages. The CLI stays the way to install;
the site is for discovery: find a plugin or a skill, read its documentation, see its
dependencies and trust profile, and copy the install command.

Out of scope for the first version: a backend, accounts, ratings, download counters,
comments.

## Architecture

```text
.claude-plugin/marketplace.json ─┐
plugins/*/.claude-plugin/plugin.json, README.md, CHANGELOG.md, COMPATIBILITY.md
plugins/*/skills/*/SKILL.md, agents/*.md, commands/*.md, hooks/hooks.json, .mcp.json
                                 │  scripts/build-index.mjs  (Node ≥ 22, no dependencies)
                                 ▼
site/public/index.json  releases.json  stats.json  feed.xml  bodies/<id>.md
                                 │  site/ (React + TypeScript + Vite)
                                 ▼
site/dist/  ──►  GitHub Pages
```

- Generated files (`site/public/*.json`, `feed.xml`, `bodies/`) and `site/dist/` are **not
  committed**; `.gitignore` lists them.
- `vite.config.ts` uses `base: './'` and the app uses hash routes, so the site works from
  the repository subpath (`https://<owner>.github.io/<repo>/`) with no server rewrites.
- Pull requests build the index and the frontend (`.github/workflows/site.yml`); a push to
  `main` repeats the build and publishes `site/dist` (`.github/workflows/pages.yml`).

Local run:

```sh
npm run build:index
cd site && npm ci && npm run build && npm run preview   # or: npm run dev
```

## Routes

| Route | Page |
|---|---|
| `#/` | Home: hero search box, example searches, plugin cards |
| `#/search?q=&type=` | Search results across plugins and components, type tabs with counts |
| `#/plugin/<name>?c=<type>:<component>` | Plugin detail; `c` highlights and scrolls to one component |
| `#/artifact/<id>` | One component (skill, agent, command, hook, MCP server) with its rendered body |
| `#/whats-new?plugin=` | Release feed from every `CHANGELOG.md`, newest first, filterable by plugin |
| `#/getting-started` | Add the marketplace, install, update, team setup, troubleshooting |
| `#/stack?p=&scope=` | Install builder: pick plugins, see auto-installed dependencies, copy commands or `settings.json` |

Unknown routes render "Not found". `#/releases` redirects to `#/whats-new`.

## Index format (`index.json`)

```jsonc
{
  "schemaVersion": 2,
  "generatedAt": "2026-10-21T09:00:00Z",          // ISO time of the build
  "marketplace": { "name", "description", "owner", "repo", "branch" },
  "plugins": [{
    "name", "displayName", "version", "description", "author", "license", "keywords": [],
    "minClaudeCode": "2.1.110",                     // from COMPATIBILITY.md "Minimum:", else null
    "updatedAt": "2026-10-21",                      // date of the newest CHANGELOG entry
    "source": "./plugins/<name>",
    "overview": ["…"],                              // first paragraphs of README.md
    "readme": "bodies/plugin--<name>.md",
    "dependencies": [{ "name", "version" }],
    "usedBy": ["<plugin>"],                         // reverse dependencies
    "userConfig": [{ "key", "description", "sensitive" }],
    "components": [{
      "id": "<plugin>--<type>--<name>",             // also the artifact route id
      "type": "skill | agent | command | hook | mcp",
      "name", "description", "keywords": [],
      "tools": [], "model",                          // agents
      "userInvocable", "argumentHint",               // skills and commands
      "event", "matcher", "command",                 // hooks
      "transport", "hosts": [],                      // MCP servers
      "body": "bodies/<id>.md",                       // markdown, frontmatter stripped
      "searchText": "…"                               // plain text of the body, ≤ 4 000 chars
    }],
    "changelog": [{ "version", "date", "changes": ["Added: …"] }]
  }]
}
```

`releases.json` is the flattened changelog (`[{ plugin, version, date, changes, breaking,
firstRelease }]`, newest first). `stats.json` holds counts (plugins, components per type,
releases) for the home page. `feed.xml` is an Atom feed of the same releases.

The builder fails (exit 1) when `marketplace.json` names a plugin whose manifest is missing,
so a broken catalog never reaches Pages.

## Search

- In-browser [MiniSearch](https://github.com/lucaong/minisearch) over plugins and components.
- Fields and boosts: `name` ×6, `keywords` ×4, `description` ×2.5, `plugin` ×1.2,
  `text` ×1 (README for plugins, `SKILL.md`/agent body for components).
- Prefix search and fuzzy matching (0.2) on; terms are expanded with a synonym table
  (e.g. `test → tdd, testing`, `spec → specification, requirements`).
- Type words in the query ("skill", "agents", "hook") filter by type instead of being
  matched as text; an explicit type tab wins, and "Show all types" clears the filter.
- Matches in titles and descriptions are highlighted with `<mark>`.
- `/` focuses the search box; `Esc` clears it.

## Markdown and safety

Content comes from the repository and is not trusted HTML.

- Markdown is rendered with `marked` and **always** passed through DOMPurify before it is
  inserted; no other code path inserts HTML from the index.
- Links inside rendered markdown get `rel="noopener noreferrer"` and open in a new tab;
  relative links are rewritten to the file on GitHub.
- Everything else is rendered as text by React.

## Plugin detail page

Must show: display name, `name`, version, updated date, owner (author), description and
keywords; **compatibility** (minimum Claude Code), license and source link;
**dependencies** (with ranges, linked) and "used by"; every component grouped by type, each
linking to its artifact page; the trust panel (hooks that run locally, network access,
agents that can write or run commands, secrets it asks for); the changelog; and the install
panel with a **Copy install** button that copies exactly

```text
/plugin install <name>@<marketplace>
```

plus a shell/project variant (`claude plugin install <name>@<marketplace> --scope project`).

## Artifact page

Type badge, `<plugin>:<name>` and how to use it (`/<plugin>:<skill>` for user-invocable
skills and commands, `@agent-<plugin>:<agent>` for agents), tools with write tools
flagged, hook event/matcher/command, the rendered body, and links to the plugin and to the
file on GitHub.

## Acceptance checks

- A plugin and its nested skills are found by search (e.g. `sdd-engineering`,
  `run-plan`, `onion architecture`).
- Version and dependencies on the plugin page equal its `plugin.json`.
- **Copy install** copies `/plugin install <name>@dev-digest-ai-marketplace`.
- Markdown with a `<script>` or `onerror=` attribute renders without executing it.
- The site works under a subpath and at 375 px width, in dark and light themes.
