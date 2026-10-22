# onion-architecture — authoring digest

Short rules for agents **writing** code (`implementer`). Reviewers use the full
skill ([SKILL.md](SKILL.md) + [enforcement.md](enforcement.md)). Invoke the full
skill instead of this digest when the task adds a **new external integration**,
scaffolds a **new module**, or wires something into `container.ts`.

Paths are the reference layout; the project's own layer map (`CLAUDE.md`/`AGENTS.md`)
overrides the names.

Dependency rule: an import may only point inward (toward domain types and
business rules), never outward toward a framework/SDK/DB.

| File | May import | Must NOT import |
|---|---|---|
| `routes.ts` | its own `service.ts`, `@app/shared` contracts, Fastify types | `drizzle-orm`, `postgres`, `db/client`, `db/schema/*`, any SDK |
| `service.ts` | ports (e.g. `LLMProvider`/`PaymentGateway`/`Mailer`) via the `Container`, own `repository.ts`/`helpers.ts`, other modules' services | `octokit`, `openai`, `@anthropic-ai/sdk`, `simple-git`, `drizzle-orm`, `db/*` |
| `repository.ts` | `drizzle-orm`, `db/client`, `db/schema/*` | SDKs; must return shared/domain types, not `$inferSelect` |
| `@app/shared/contracts/*` | `zod` only | anything from the server or client packages |
| optional pure `core/src/**` | `zod`, `@app/shared`, ports passed in as arguments | DB, network clients, filesystem |

Where new code goes:
1. New SDK/API → port in `@app/shared/adapters.ts`, impl in
   `src/adapters/<name>/`, mock in `adapters/mocks.ts`, wire in
   `platform/container.ts`. Only that adapter imports the SDK.
2. Business rule / orchestration → `service.ts`; constructor takes the whole
   `Container`.
3. Shared shape → Zod schema in `@app/shared/contracts/*.ts` (if the client
   keeps its own copy of the contracts, update both).
4. Endpoint → `routes.ts`: parse → call **one** service method → map to status/body.
   No branching business logic, no queries.
5. Query → `repository.ts`; map Drizzle rows to domain types before returning.
6. Call into another module → `new OtherService(this.container)` at the call site.

Module files are role-named: `routes.ts`, `service.ts`, `repository.ts`,
`helpers.ts`, `constants.ts`. Never `new` an SDK client in a service or route.
