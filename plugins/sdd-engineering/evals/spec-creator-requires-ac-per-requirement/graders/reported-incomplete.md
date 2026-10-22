---
type: llm
---

PASS if the final reply reports that the spec is incomplete or not ready for approval because the rate-limit requirement has no acceptance criterion (for example a `Spec INCOMPLETE: 1 mandatory requirement(s) without an acceptance criterion` line), and names what is needed (the limit and the window).
FAIL if the reply presents the spec as finished or ready for approval, or does not mention the rate-limit requirement lacking an acceptance criterion.
