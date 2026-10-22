# frontend-ui-architecture — authoring digest

Short rules for agents **writing** code (`implementer`). Reviewers use the full
skill ([SKILL.md](SKILL.md) and its linked files). Invoke the full skill instead
of this digest when the task creates a **new feature folder or route**, or
splits/moves existing components.

Placement — the reference layout below; the project's own conventions
(frontend `AGENTS.md`/`CLAUDE.md`) win over it:
- Route-scoped component → `src/app/<route>/_components/<PascalCaseName>/<Name>.tsx`
  (+ optional `<Name>.test.tsx`, `helpers.ts`, `styles.ts`).
- Shared/generic component (used by ≥2 routes/features) → `src/components/<kebab-case>/`.
- Shared data hook → one file per domain in `src/lib/hooks/<domain>.ts`
  (`users.ts`, `orders.ts`, …). Single-consumer hook → colocate with its component.
- Shared API contracts → wherever the project keeps them (a shared package or a
  vendored copy); never redefine a contract type inside a component.

Rules:
- Colocate by feature; don't promote to a shared folder until a second consumer exists.
- No deep cross-feature imports (one route reaching into another route's
  `_components/`/helpers) — promote the piece to the shared layer instead.
- No barrel `index.ts` that just re-exports a folder.
- Pure calculation/validation/formatting → a plain function in `helpers.ts`, not
  inside a component body or `useEffect`; hooks call those functions.
- Constants used by one component live next to it; `helpers.ts`/`utils` split by
  concern, never a junk drawer.
