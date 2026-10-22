---
type: llm
---

PASS if the reply says there is no finished multi-agent workflow run in this conversation to analyse (and, optionally, suggests `--deep` with a session id or running the retro after a run), without reporting token counts, agent counts, fix rounds or proposals.
FAIL if the reply presents retro numbers, insights or a proposals table as if a run had happened.
