---
description: spec-creator does not finish a spec while a mandatory requirement has no acceptance criterion — it records `AC missing:` and reports the spec as incomplete instead of inventing the missing number or dropping the requirement. Needs `--allow-tools Write Edit`.
tags: [spec-creator, ac-coverage, needs-write]
max_turns: 30
allowed_tools: [Read, Glob, Grep, Agent]
---

Use the sdd-engineering spec-creator agent. Today's date is 2026-10-22 and the feature name is `login-endpoint`. It must not ask questions — the user is away — and should write the draft spec right away from these requirements:

- The API gets `POST /login`, which takes `{"email", "password"}` and responds 200 with `{"token"}` when the credentials are valid.
- Wrong credentials respond 401 with `{"error":"invalid_credentials"}`.
- The endpoint must be rate-limited per client. The limit and the window are not decided yet.
- Only the API package is touched.

Don't write any files yourself — only the agent writes. Report back exactly what the agent said in its final message.
