# engineering-paved-path

The one home for technical skills that several agents and plugins use. Other plugins
depend on it and reference its skills by namespaced name
(`engineering-paved-path:onion-architecture`) instead of keeping their own copies.

```sh
claude plugin install engineering-paved-path@dev-digest-ai-marketplace
```

## Skills

| Skill | Scope | What it covers |
|---|---|---|
| `skill-routing` | Meta | Which skills apply to which files; reads the project's `.claude/skill-routing.md`, else a default map ([template](skills/skill-routing/templates/skill-routing.md)) |
| `onion-architecture` | Backend | Dependency direction, layer placement, ports and adapters; `RULES.md` digest for authoring |
| `frontend-ui-architecture` | Frontend | Where React/Next.js code lives, colocation, splitting components; `RULES.md` digest |
| `security` | Full-stack | OWASP Top 10:2025, auth, injection, uploads, secrets; `RULES.md` digest |
| `fastify-best-practices` | Backend | Routes, plugins, JSON-schema validation, error handling |
| `drizzle-orm-patterns` | Backend | Schema, queries, relations, transactions, migrations |
| `postgresql-table-design` | Backend | Data types, indexing, constraints, partitioning |
| `next-best-practices` | Frontend | App Router, RSC boundaries, data patterns, async APIs |
| `react-best-practices` | Frontend | React anti-patterns, state, hooks rules |
| `react-testing-library` | Frontend | RTL with Vitest: queries, userEvent, async, mocking |
| `zod` | Full-stack | Schema validation, parsing, errors, type inference |
| `typescript-expert` | Full-stack | Type-level programming, tooling, strictness |
| `mermaid-diagram` | Shared | Mermaid diagrams in markdown |

`onion-architecture` and `frontend-ui-architecture` describe a **reference layout**; a
project's own layer map in `CLAUDE.md`/`AGENTS.md` overrides its paths and names.

**Digest vs. full skill.** Agents that write code read the short `RULES.md` of
`onion-architecture`, `frontend-ui-architecture` and `security`, and load the full skill
only for new modules, integrations, route folders, auth/secrets/uploads, or when a plan
marks it `full`. Reviewers use the full skill. `skill-routing` holds these rules.

Skill evals are not shipped with the plugin: the `onion-architecture` cases in the
[skill-creator](https://code.claude.com/docs/en/skills#run-evals-with-skill-creator)
`evals.json` format live in the marketplace's
[`evals/skills/onion-architecture/skill-creator`](../../evals/skills/onion-architecture/skill-creator), and the marketplace's [`evals/`](../../evals) engine runs static quality
checks over every skill (`pnpm eval:quality`).

## Credits

Origin of each skill, checked on 2026-10-21 by comparing `SKILL.md` with the source. Skills
under an MIT license keep the original `LICENSE` file in their folder.

| Skill | Source | License |
|---|---|---|
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) `skills/fastify` | MIT, © 2026 Matteo Collina |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) `plugins/database-design/skills/postgresql` @ `7b7d968` | MIT, © 2024 Seth Hobson |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) `plugins/developer-kit-typescript/skills/drizzle-orm-patterns` | MIT, © 2025 Giuseppe Trisciuoglio |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) `skills/.curated/zod` | MIT, © 2025 pproenca |
| `typescript-expert` | [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) `skills/typescript-expert` (modified) | MIT, © 2026 Antigravity User |
| `security`, `mermaid-diagram` | [ai-agentic-engineering-neo/dev-digest](https://github.com/ai-agentic-engineering-neo/dev-digest) course template; OWASP Top 10:2025 categories by the OWASP Foundation (CC BY-SA 4.0) | MIT, © 2026 Ivan Lapa |
| `react-best-practices`, `react-testing-library` | [burnjohn/ai-demo-marketplace](https://github.com/burnjohn/ai-demo-marketplace) | not stated |
| `next-best-practices` | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) @ `dc1de9c` (now superseded by the skills in [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills)) | not stated |
| `onion-architecture`, `frontend-ui-architecture`, `skill-routing` | written for this marketplace | MIT (marketplace license) |

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
