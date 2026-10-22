---
type: llm
focus:
  source: file
  path: specs/2026-10-21-health-endpoint/spec.md
---

PASS if the spec has a header with a `SPEC-` id and `Status: draft`, and its acceptance criteria are numbered (AC-1, …), written in EARS with "shall", include the 50 ms limit as a number, and each ends with a `Verify:` hint.
FAIL if the file is missing, has no acceptance criteria, uses vague wording instead of the 50 ms number, or contains implementation code.
