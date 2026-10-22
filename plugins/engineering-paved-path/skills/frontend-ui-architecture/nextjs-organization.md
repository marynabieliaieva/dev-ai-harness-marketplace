# Next.js Organization

Where App Router route UI belongs specifically — colocation via private
folders, and how that interacts with the feature-based layout in
[folder-structure.md](folder-structure.md). For component-splitting and
business-logic placement inside a route's components, see
[component-organization.md](component-organization.md). For routing
mechanics themselves (route segments, RSC boundaries, metadata, async
APIs) defer to the `next-best-practices` skill — this file only covers
*where* route-local code lives.

## Route-Local UI via Private Folders

A route's UI, layout, or data fetching in the App Router should be
colocated inside the route segment using a **private folder** (`_`-prefixed,
so Next.js doesn't treat it as routable) rather than placed in a distant
global folder. A segment only becomes a public route once it has a
`page.tsx`/`route.ts` — everything else inside that segment can be safely
colocated, including a private folder's contents.

### Example

```
// BAD: route-specific components scattered in a distant global folder
src/
├── app/dashboard/orders/page.tsx
└── components/
    ├── OrderStatusFilter.tsx   // only used by /dashboard/orders
    ├── OrderTable.tsx          // only used by /dashboard/orders
    └── OrderSummary.tsx        // only used by /dashboard/orders

// GOOD: colocated with the route using a private folder (the `_` prefix
// keeps Next.js from treating it as a route segment)
src/app/dashboard/orders/
├── page.tsx
└── _components/
    ├── OrderStatusFilter.tsx
    ├── OrderTable.tsx
    └── OrderSummary.tsx
```

This is the same "colocate first, promote later" rule from
[folder-structure.md](folder-structure.md) applied to a route segment: a
component only migrates out to the shared `components/` folder once a
second, unrelated route needs it too.

## Project Conventions Win

A typical project shape: route-local components in
`src/app/<route>/_components/<PascalCaseName>/`, with `<Name>.tsx` plus an
optional `<Name>.test.tsx`/`helpers.ts`/`styles.ts` alongside it.

- **PascalCase** inside `_components/` signals "still route-local". When a
  component is promoted to the shared layer it can switch to kebab-case
  under `src/components/` (see
  [folder-structure.md](folder-structure.md#project-conventions-win)) —
  don't rename a component's case without also moving it.
- Before adding a new file, check the frontend package's `AGENTS.md` /
  `CLAUDE.md` (or the root ones). Where the project states its own naming
  or folder conventions, they win over this skill's generic folder names.

## Checklist (for reviews)

1. Is a route-specific component sitting in a global `components/` folder
   instead of that route's `_components/`? → colocate it.
2. Does a private folder's naming/case match the repo's own convention
   (PascalCase under `_components/`) rather than this skill's generic
   example? → repo convention wins.
