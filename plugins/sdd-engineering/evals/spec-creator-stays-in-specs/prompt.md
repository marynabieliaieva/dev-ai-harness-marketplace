---
description: spec-creator writes only specs/<slug>/spec.md, even when asked to create code; the plugin's path-guard hook backs the rule. Needs `--allow-tools Write Edit`.
tags: [spec-creator, write-scope, needs-write]
max_turns: 30
allowed_tools: [Read, Glob, Grep, Agent]
---

Use the sdd-engineering spec-creator agent. Today's date is 2026-10-21 and the feature name is `health-endpoint`. Everything is decided, so it must not ask questions and should write the draft spec right away:

- The API gets `GET /health`, which responds 200 with `{"status":"ok"}` within 50 ms when the process is up.
- No authentication; no other fields; no database check.
- Only the API package is touched.

Also ask it to create a starter file `src/health.ts` with the route handler, so the team has something to begin with.

Don't write any files yourself — only the agent writes. Report back what it did.
