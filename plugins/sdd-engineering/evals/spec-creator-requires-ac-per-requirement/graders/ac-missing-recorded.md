---
type: llm
focus:
  source: file
  path: specs/2026-10-22-login-endpoint/spec.md
---

PASS if all of these hold:
- the header says `Status: draft`;
- the 200 and 401 behaviours each have an EARS acceptance criterion with an ID;
- the rate-limit requirement is still in the spec (not dropped and not moved to Non-goals) and is listed under `[NEEDS CLARIFICATION]` as an `AC missing:` entry (or equivalent wording) saying the limit and window are needed;
- no acceptance criterion states a concrete rate limit or window (for example "5 requests per minute") — the user never gave one.

FAIL if the file is missing, the rate-limit requirement is absent, a rate-limit AC uses an invented number, or the rate limit is covered by a vague AC ("shall be rate-limited") with no open item recording that its numbers are missing.
