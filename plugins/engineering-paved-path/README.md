# engineering-paved-path

The one home for the technical skills that agents and people use while writing and
reviewing TypeScript full-stack code: architecture, security, React/Next.js, Fastify,
Drizzle, PostgreSQL, Zod, TypeScript and diagrams. Other plugins depend on it and
reference its skills by namespaced name (`engineering-paved-path:onion-architecture`)
instead of keeping their own copies — one source, one version.

```sh
claude plugin install engineering-paved-path@dev-digest-ai-marketplace
```

No dependencies. Used by [`architecture-review`](../architecture-review) (the
architecture rule sets behind its findings) and [`sdd-engineering`](../sdd-engineering)
(`implementer` applies the skills `skill-routing` assigns to each file; the planner lists
them per task).

## Skills

| Skill | Scope | What it covers |
|---|---|---|
| `skill-routing` | Meta | Which skills apply to which files, digest vs. full skill; reads your `.claude/skill-routing.md`, else a role-based default map |
| `onion-architecture` | Backend | Dependency direction, layer placement, ports and adapters, the composition root, error envelope; `RULES.md` digest |
| `frontend-ui-architecture` | Frontend | Where React/Next.js code lives, colocation, when to promote to shared, splitting components; `RULES.md` digest |
| `security` | Full-stack | OWASP Top 10:2025, auth/sessions, injection, uploads, secrets, untrusted LLM input; `RULES.md` digest |
| `fastify-best-practices` | Backend | Routes, plugins, hooks, JSON-schema validation, error handling, logging, testing, deployment |
| `drizzle-orm-patterns` | Backend | Schema, queries, joins, relations, transactions, migrations |
| `postgresql-table-design` | Backend | Data types, keys, indexing, constraints, partitioning |
| `next-best-practices` | Frontend | App Router file conventions, RSC boundaries, async APIs, data patterns, metadata, images, fonts, self-hosting |
| `react-best-practices` | Frontend | React anti-patterns, state, effects, hooks rules |
| `react-testing-library` | Frontend | RTL with Vitest: queries, `userEvent`, async utilities, mocking |
| `zod` | Full-stack | Schema design, parsing, errors, composition, type inference, performance |
| `typescript-expert` | Full-stack | Type-level programming, strict tsconfig, monorepo setup, type-check performance |
| `mermaid-diagram` | Shared | Mermaid diagrams in markdown: flowcharts, sequence, ERD, state |

## How to use them

**Automatically.** Each skill's description says when it applies, so Claude loads it on
its own when a task matches — editing a Fastify route pulls in `fastify-best-practices`,
adding a table pulls in `postgresql-table-design`.

**By name.** Invoke a skill directly when you want its guidance up front:

```text
/engineering-paved-path:security review the upload handler in src/modules/files
/engineering-paved-path:onion-architecture where should a new Stripe integration go?
/engineering-paved-path:mermaid-diagram sequence diagram of the checkout flow
```

`skill-routing` and `next-best-practices` are model-only (`user-invocable: false`); they
load when relevant.

**From your own agents.** Give the agent the `Skill` tool and name skills in its prompt
by their namespaced name, or point it at `engineering-paved-path:skill-routing` so it
picks skills per file:

```markdown
Load `engineering-paved-path:skill-routing` once; apply the skills it assigns to the
files you touch (the RULES.md digest for authoring, the full skill for review).
```

Declare the dependency in your plugin's `plugin.json`:

```json
"dependencies": [{ "name": "engineering-paved-path", "version": "^1.0.0" }]
```

## Digest vs. full skill

`onion-architecture`, `frontend-ui-architecture` and `security` ship a short `RULES.md`
next to `SKILL.md`. Agents that **write** code read the digest; they load the full skill
only for a new module, external integration or route folder, for auth/secrets/uploads/
shelling out, or when a plan marks the skill `full`. Agents that **review** code always
use the full skill. This keeps authoring cheap without weakening review. The rules live in
`skill-routing`, so every agent applies the same policy.

## Fitting the skills to your project

The skills are generic; your project's conventions win.

- **Your layout overrides the reference layout.** `onion-architecture` and
  `frontend-ui-architecture` describe a reference layout (`src/modules/<name>/…`,
  `src/app/<route>/_components/…`). State your own layer map in `CLAUDE.md`/`AGENTS.md`
  and the skills map their roles onto your files ([how](skills/onion-architecture/layer-map.md#mapping-a-project-onto-the-layers)).
- **Your file → skill map.** Without one, `skill-routing` resolves its default map by role
  (the frontend package, the backend package, the files importing `drizzle-orm`…) and
  reports the mapping it used. To pin it down, copy
  [templates/skill-routing.md](skills/skill-routing/templates/skill-routing.md) to
  `.claude/skill-routing.md` and edit the globs; it then replaces the default map
  entirely — including your exclusions (generated code, migrations, lock files).
- **Stack.** The backend skills assume Fastify + Drizzle + PostgreSQL and the frontend
  skills React/Next.js. Skills for a stack you don't use simply never fire.

## Evals

Skill evals are not shipped with the plugin: the `onion-architecture` cases in the
[skill-creator](https://code.claude.com/docs/en/skills#run-evals-with-skill-creator)
`evals.json` format live in the marketplace's
[`evals/skills/onion-architecture/skill-creator`](../../evals/skills/onion-architecture/skill-creator),
and the marketplace's [`evals/`](../../evals) engine runs static quality checks over every
skill (`pnpm eval:quality`).

## Runtime

Everything is markdown except `typescript-expert/scripts/ts_diagnostic.py`, an optional
helper that needs Python 3. No skill runs code on its own.

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

## Versions

Renaming or removing a skill or a `RULES.md` digest breaks agents that reference it by
name, so it is a MAJOR release. See [CHANGELOG.md](CHANGELOG.md) and
[COMPATIBILITY.md](COMPATIBILITY.md).
