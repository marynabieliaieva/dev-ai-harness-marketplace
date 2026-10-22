---
name: skill-routing
description: Decides which engineering-paved-path skills apply to a set of files or a task — for agents that write code (implementer, test writers, planners) and agents that review it. Reads the project's own file→skill map (.claude/skill-routing.md) when it exists, otherwise uses the default map in this skill. Use before writing or reviewing code to pick skills once per session instead of per file, and to decide digest (RULES.md) vs. full skill.
user-invocable: false
---

# Skill routing

One place that answers "which skills apply to these files?" so that agents
link here instead of keeping their own copies of the table.

## 1. Find the map

1. **Project map first.** If `${CLAUDE_PROJECT_DIR}/.claude/skill-routing.md`
   exists, it is the authoritative map: its globs, its exclusions and its
   digest/full rules win over everything below. Do not merge it with the
   default map.
2. **Otherwise use the default map** in section 3. Its globs assume a
   `client/` (React/Next.js) + `server/` (TypeScript backend) layout; translate
   them to the project's real folders once, from the project's `CLAUDE.md` /
   `AGENTS.md` or its directory tree, and say in your report which mapping
   you used.

To give a project its own map, copy [templates/skill-routing.md](templates/skill-routing.md)
to `.claude/skill-routing.md` in that project and edit the globs.

## 2. Rules that hold for every map

- **Skill names are namespaced**: invoke `engineering-paved-path:<skill>`
  (for example `engineering-paved-path:onion-architecture`).
- **Once per session, not once per file.** Load a skill the first time a file
  in its bucket comes up; reuse it for the rest of the session.
- **Digest by default for authoring.** `onion-architecture`,
  `frontend-ui-architecture` and `security` ship a short `RULES.md` digest.
  An agent that *writes* code reads the digest
  (`${CLAUDE_PLUGIN_ROOT}/skills/<skill>/RULES.md`); it invokes the full skill
  only when the task creates a new module, route/feature folder or external
  integration, touches auth/secrets/uploads/shelling out, or the plan marks
  the skill `full`.
- **Reviewers use the full skill** for every bucket that matched.
- **A plan's "Key constraints" win** over re-reading a skill: if the plan
  already states the rule, apply it without loading the skill again.
- **Excluded files** (generated code, migrations, lock files — the project's
  "do not touch" list) are never bucketed, counted or reviewed.
- **Unmatched files**: say "no specific skill matched" in the report. Never
  invent a skill assignment that isn't in the map.

## 3. Default map

### Frontend

| Skill | Default globs | Notes |
|---|---|---|
| `frontend-ui-architecture` | `client/src/**` | Where a component/hook/util belongs; digest for authoring |
| `react-best-practices` | `client/**/*.tsx`, `client/**/*.jsx` | Component/hook correctness |
| `next-best-practices` | `client/src/app/**`, `client/next.config.*` | App Router, RSC boundaries, async APIs |
| `react-testing-library` | `client/**/*.test.ts(x)` | Test files only |

### Backend

| Skill | Default globs | Notes |
|---|---|---|
| `onion-architecture` | `server/src/modules/**`, pure domain packages | Dependency direction, layer placement; digest for authoring |
| `fastify-best-practices` | `server/src/**/routes.ts`, `server/src/app.ts`, `server/src/platform/**` | Routes, plugins, hooks, validation |
| `drizzle-orm-patterns` | `server/src/db/**` (excluding migrations) | Schema and query authoring |
| `postgresql-table-design` | `server/src/db/schema/**` | Schema design |

### Cross-cutting

| Skill | Trigger | Notes |
|---|---|---|
| `security` | by topic: user input, endpoints, secrets, auth, uploads, shelling out | Digest for authoring, full skill for auth/secrets/uploads/shelling out and for every review |
| `zod` | `**/*.schema.ts`, shared contract files | Also check for breaking changes to shapes other packages import |
| `typescript-expert` | on demand | Only for non-trivial generic/type-level work |
| `mermaid-diagram` | on demand | Diagrams in docs, specs and plans |

### Tests

Test files need only `react-testing-library` (client tests). Production-code
skills are **not** applied to test files; for a backend test, read the digest
of the skill governing the *file under test* only if needed to know which port
to stub.
