# Onion Architecture — Layer Map

How the five Onion layers map onto the reference layout this skill uses, and
how to map them onto a project's own files. Read [SKILL.md](SKILL.md) first for
the core Dependency Rule this table enforces.

## The Five Layers

```
┌───────────────────────────────────────────────────┐
│ Interface / Transport — routes.ts                  │
│ parses request → calls service → maps result       │
│ ┌───────────────────────────────────────────────┐ │
│ │ Infrastructure — src/adapters/*, repository.ts │ │
│ │ implements the ports                           │ │
│ │ ┌───────────────────────────────────────────┐ │ │
│ │ │ Ports (boundary) — shared/adapters.ts      │ │ │
│ │ │ interfaces only, no I/O                    │ │ │
│ │ │ ┌───────────────────────────────────────┐ │ │ │
│ │ │ │ Application — service.ts               │ │ │ │
│ │ │ │ orchestrates, depends on ports         │ │ │ │
│ │ │ │ ┌───────────────────────────────────┐ │ │ │ │
│ │ │ │ │ Domain (center) —                  │ │ │ │ │
│ │ │ │ │ shared/contracts, pure core/       │ │ │ │ │
│ │ │ │ └───────────────────────────────────┘ │ │ │ │
│ │ │ └───────────────────────────────────────┘ │ │ │
│ │ └───────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

| Layer | Reference location | May import | Must NOT import |
|---|---|---|---|
| **Domain** (center) | `@app/shared/contracts/*.ts` (Zod-derived types); an optional pure `core/` package | nothing outward — plain TS/Zod only | the HTTP framework, the ORM, SDK clients, Node `fs`/`net` |
| **Application** | `src/modules/<name>/service.ts` | domain types, ports from `shared/adapters.ts` | concrete SDKs directly (`octokit`, `openai`, `@anthropic-ai/sdk`, `simple-git`) — only through an injected port; also the ORM and any `db/client`/`db/schema/*` import — persistence goes through `repository.ts`, same rule as `routes.ts` below |
| **Ports** (boundary) | `@app/shared/adapters.ts` (e.g. `GitHubClient`, `GitClient`, `LLMProvider`, `SecretsProvider`) | domain types only | any concrete implementation |
| **Infrastructure** | `src/adapters/<name>/*`; `repository.ts` (ORM) | the SDK it wraps, the port interface it implements | nothing else in the module — no business rules here |
| **Interface / Transport** | `src/modules/<name>/routes.ts` | the module's `service.ts` | the ORM, SDK clients, business logic |

## Mapping a Project onto the Layers

Before applying a rule, find the project's own name for each role:

1. **Read the project's layer map first.** `CLAUDE.md`, `AGENTS.md` (root and
   per package) or an architecture doc often state the module layout, the
   shared contracts package and where adapters live. Those names override the
   reference layout everywhere in this skill.
2. **Otherwise infer it from one existing module.** Pick a module that talks to
   both the database and an external service, and identify its transport file,
   its orchestration file, its persistence file and where its external client
   comes from. Use that module as the pattern to copy.
3. **Find the composition root.** The file that constructs adapters and hands
   them to services (a DI container, a Fastify plugin that `decorate`s, a
   factory) plays the `container.ts` role. If services `new` SDK clients
   themselves, there is no composition root yet — flag that as the gap rather
   than inventing one inside an unrelated change.
4. **Note where the pattern is not followed yet.** The usual gap is
   persistence: repositories are instantiated directly by services, with no
   port. That is acceptable for existing modules (retrofitting every
   repository is rarely worth the churn on its own), but **new modules with
   non-trivial repository logic should consider a repository interface** so
   the service can be tested against a mock the same way external clients
   already are. Flag the gap in review rather than silently copying the
   un-inverted pattern forward — see [enforcement.md](enforcement.md).

## The Repository ↔ Service Seam

The repository↔service seam is where a raw ORM type is allowed to exist, and
only there. A repository may return `RepoRow` (`type RepoRow = typeof
t.repos.$inferSelect`); the service immediately maps it through a helper such as
`toRepoDto()` into the Zod-derived domain type before returning. A public
`service.ts` method should never return a `$inferSelect`/`$inferInsert` type —
if one escapes past `service.ts`, that's a layering violation (see
[enforcement.md](enforcement.md) and the example in [examples.md](examples.md)).
