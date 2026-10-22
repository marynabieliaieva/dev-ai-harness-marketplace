# File → skill routing

Project map for `engineering-paved-path:skill-routing`. Copy to
`.claude/skill-routing.md` and edit the globs to this project's layout.
When this file exists it replaces the plugin's default map entirely.

## Excluded (never bucketed, counted or reviewed)

- `**/migrations/**`
- `**/pnpm-lock.yaml`, `**/package-lock.json`

## Buckets

| Skill | Globs or trigger | Authoring | Notes |
|---|---|---|---|
| `frontend-ui-architecture` | `web/src/**` | digest | |
| `react-best-practices` | `web/**/*.tsx` | digest | |
| `next-best-practices` | `web/src/app/**` | digest | |
| `react-testing-library` | `web/**/*.test.tsx` | full | test files only |
| `onion-architecture` | `api/src/modules/**` | digest | full for a new module or integration |
| `fastify-best-practices` | `api/src/**/routes.ts` | digest | |
| `drizzle-orm-patterns` | `api/src/db/**` | digest | |
| `postgresql-table-design` | `api/src/db/schema/**` | full | |
| `zod` | `packages/contracts/**` | digest | |
| `security` | topic: input, endpoints, secrets, auth, uploads | digest | full for auth/secrets/uploads |
| `typescript-expert` | on demand | — | |
| `mermaid-diagram` | on demand | — | |
