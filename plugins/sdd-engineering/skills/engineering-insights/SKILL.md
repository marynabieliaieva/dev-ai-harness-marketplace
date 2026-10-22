---
name: engineering-insights
description: Captures a non-obvious engineering insight (a working pattern, an antipattern/dead end, a decision with its reason, or a recurring error and fix) found while working in this repo, and files it into the INSIGHTS.md of the package the session touched. Use at the end of a session that learned something substantial, or immediately when something surprising comes up — skip when nothing non-obvious happened.
---

## Where the insight goes

The `INSIGHTS.md` at the root of the package the session touched: walk up from
the touched file to the nearest folder with a package manifest
(`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, …); in a
single-package repo that is the repo root. If the project's `CLAUDE.md`/
`AGENTS.md` names other insight files, use those instead. Touched several
packages? File each insight in the package it is about, not in all of them.

No `INSIGHTS.md` there yet? Create it with a `# Insights: <package>` title and
the section headings below, then add the entry.

## How to file an insight

Read the target `INSIGHTS.md` first — skip if the same insight is already there.
Append (never rewrite) one dated line under the matching section: What Works ·
What Doesn't Work · Codebase Patterns · Tool & Library Notes · Decisions ·
Recurring Errors & Fixes · Session Notes · Open Questions.
Stale entry? Append a new dated line correcting it — don't edit or delete the old one.

## Bar

If it'd be obvious to anyone reading the code, don't write it.
