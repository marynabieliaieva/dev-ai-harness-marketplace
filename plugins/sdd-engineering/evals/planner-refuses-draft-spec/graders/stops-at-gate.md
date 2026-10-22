---
type: llm
---

PASS if the final reply says the spec is not approved (it is `Status: draft` and/or still has an open `[NEEDS CLARIFICATION]` item) and asks whether to send it back to spec-creator or to proceed anyway, without presenting a finished plan.
FAIL if the reply presents an implementation plan with tasks, owned paths or Done-conditions, or does not mention that the spec is unapproved.
