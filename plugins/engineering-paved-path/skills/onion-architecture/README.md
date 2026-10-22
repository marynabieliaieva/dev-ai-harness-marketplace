# Onion Architecture (Backend) Skill

**Version:** 1.1.0
**Compiled:** 2026-09-21

## What this skill is

A skill that enforces Onion/Layered Architecture for TypeScript backends
(Fastify + Drizzle in the reference layout). It governs **which direction
code is allowed to depend**: domain types and pure domain packages at the
center, application orchestration (`service.ts`) next, port interfaces
(`shared/adapters.ts`) as the boundary, concrete adapters and ORM
repositories as infrastructure, and `routes.ts` as the outermost,
transport-only layer.

It was first written for a production Fastify/Drizzle monorepo that already
followed this pattern for external I/O (every SDK behind a port, wired through
one container) but not yet for persistence. The paths in this skill are that
reference layout; a project's own layer map overrides them (see
[layer-map.md](layer-map.md#mapping-a-project-onto-the-layers)). The skill
documents the good pattern so it gets copied correctly for new work, and
flags the common persistence gap so reviews catch new instances of it instead
of normalizing it further.

## When this skill fires

- Scaffolding a new backend module (`src/modules/<name>/` in the reference layout).
- Adding a new external integration — a new SDK, API client, or a new kind of
  database access.
- Reviewing a PR that touches `routes.ts`, `service.ts`, or `repository.ts`.
- Deciding whether a piece of code belongs in the domain, application, or
  infrastructure layer.
- Wiring something new into the DI container
  (`src/platform/container.ts`).
- Spotting a `service.ts` or route handler reaching for `drizzle-orm`,
  `octokit`, `openai`, or `@anthropic-ai/sdk` directly — the exact violation
  this skill exists to catch.

## Files in this skill

| File | Contents |
|---|---|
| [SKILL.md](SKILL.md) | Entry point: the Dependency Rule, relationship to sibling skills, and the "where does new code belong" decision order. |
| [layer-map.md](layer-map.md) | The five layers in the reference layout, how to map them onto a project's own files, and the repository↔service seam. |
| [enforcement.md](enforcement.md) | Anti-patterns to flag in review, an optional `dependency-cruiser` config sketch for CI enforcement, and the review checklist. |
| [examples.md](examples.md) | Before/after code for adding a new integration, a repository type leak, misplaced business logic, and a pure `core/` package as the domain center. |
| README.md (this file) | Skill overview, version, and every source the skill is built on. |

## Relationship to sibling skills

- **fastify-best-practices**, **drizzle-orm-patterns**, **zod**,
  **typescript-expert** already cover *how* to use each tool correctly
  (plugin registration, query building, schema composition, type-level
  tricks) — this skill does not repeat any of that and instead cross-refers
  to them for tool mechanics.
- **frontend-ui-architecture** is the client-side counterpart: both skills
  share the same underlying idea (dependency direction, colocation of
  concerns) applied to different runtimes.

## References

Grouped by the question each source answers in this skill.

### 1. Onion / Clean / Hexagonal — theory

- [Jeffrey Palermo — The Onion Architecture: part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) —
  the original 2008 article that coined the term and the four founding
  tenets [SKILL.md](SKILL.md)'s "Core Principle" section is built on: the
  application is built around an independent domain model, inner layers
  define interfaces that outer layers implement, and all coupling points
  toward the center.
- [Jeffrey Palermo — The Onion Architecture: part 3](https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/) —
  follow-up detailing how infrastructure concerns (DB, external services)
  get pushed to the outermost ring.
- [Milan Jovanović — Clean vs. Onion vs. Hexagonal Architecture](https://milanjovanovic.tech/blog/clean-architecture-vs-onion-vs-hexagonal) —
  the clearest practical comparison of the three; the source for this
  skill's framing that they're variations on the same Dependency Rule with
  different vocabulary, and that Hexagonal's "ports and adapters" language
  is what this skill borrows for the `shared/adapters.ts` boundary.
- [Herberto Graça — Onion Architecture](https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85) —
  part of "The Software Architecture Chronicles" series; a deeper dive into
  why the domain model must stay framework-agnostic, referenced for the
  "domain must not know HTTP/DB/messaging exist" framing.
- [Allegro Tech — Onion Architecture](https://blog.allegro.tech/2023/02/onion-architecture.html) —
  a practical engineering-blog walkthrough (not academic), useful for the
  "what actually goes wrong when you skip this" framing used in
  [enforcement.md](enforcement.md).

### 2. Node.js / TypeScript implementations

- [dev.to — Implementing SOLID and the Onion Architecture in Node.js with TypeScript and InversifyJS](https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad) —
  a full worked Node/TS example with a DI container, the closest published
  analog to the reference layout's `container.ts` pattern; referenced for
  validating that a hand-rolled DI container (rather than a framework like
  InversifyJS) is a legitimate way to wire ports to adapters.
- [LogRocket — Node.js project architecture best practices](https://blog.logrocket.com/node-js-project-architecture-best-practices/) —
  general guidance on layering a Node backend by technical capability
  (domain/application/infrastructure) rather than by feature, which is the
  layout [layer-map.md](layer-map.md)'s table follows.

### 3. Fastify as the DI/transport mechanism

- [Snyk — Fastify plugins as building blocks for a backend Node.js API](https://snyk.io/blog/fastify-plugins-for-backend-node-js-api/) —
  explains Fastify's plugin/encapsulation system as a lightweight DI
  mechanism (`.decorate()` to expose a service, `.register()` to scope it);
  the basis for treating `routes.ts` as pure transport that receives
  already-wired services rather than constructing them.
- [fastify/help#284 — What is best practice for dependency injection?](https://github.com/fastify/help/issues/284) —
  the maintainers' own discussion of DI patterns in Fastify apps; confirms
  there's no single official DI framework and a manual container (as
  the reference layout uses) is an accepted approach, not a workaround.

### 4. Drizzle ORM and the repository pattern

- [paulserban.eu — Drizzle ORM Best Practices: Principles, Patterns, and Real-World Case Studies](https://paulserban.eu/blog/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/) —
  covers repository-pattern separation with Drizzle specifically: repository
  interfaces should express business operations, not database operations,
  and should not leak raw ORM/schema details past their boundary — the
  direct source for [layer-map.md](layer-map.md)'s "repository↔service seam"
  rule.
- [Medium — Repository Pattern in Nest.js with Drizzle ORM](https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae) —
  a worked example of wrapping Drizzle behind a repository interface in a
  layered Node app; referenced for the "new modules with non-trivial
  repository logic should consider an interface" recommendation, since
  many existing codebases' repositories don't yet do this.

### 5. Zod as the domain contract layer

- [Zod documentation](https://zod.dev/) — canonical reference for
  `z.infer`/schema composition, used as the mechanism for
  `@app/shared/contracts/*.ts` domain types.
- [LogRocket — Schema validation in TypeScript with Zod](https://blog.logrocket.com/schema-validation-typescript-zod/) —
  general guidance on using a single Zod schema as the source of truth for
  both runtime validation and static types, which is why this skill treats
  `shared/contracts` (Zod-derived types) as the Domain layer rather than
  hand-written interfaces duplicated elsewhere.

## What this skill deliberately does not duplicate

- `fastify-best-practices` already covers routes, plugins, hooks, schemas,
  and the Fastify request lifecycle in depth — this skill only touches
  `routes.ts` insofar as it must stay transport-only.
- `drizzle-orm-patterns` already covers schema definition, queries, joins,
  transactions, and migrations — this skill only touches `repository.ts`
  insofar as its public boundary must not leak raw inferred types past the
  service layer.
- `zod` already covers schema definition, parsing, and type-inference rules
  in depth — this skill only relies on Zod schemas as the domain-type
  mechanism, not as a validation-authoring guide.
- `frontend-ui-architecture` is the client-side counterpart — read that one
  for anything about where client code lives.

## Changelog

- **1.1.0** (2026-10-21) — Generalized for the engineering-paved-path plugin: DevDigest
  paths became a reference layout that a project's own layer map overrides;
  "Applied in This Repo" replaced by "Mapping a Project onto the Layers".
- **1.0.0** (2026-09-21) — Initial version: layer map, enforcement rules,
  examples, and references derived from a production Fastify/Drizzle codebase.
