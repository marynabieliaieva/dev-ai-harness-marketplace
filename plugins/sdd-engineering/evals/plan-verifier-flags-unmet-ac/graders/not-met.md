---
type: llm
---

PASS if the verification marks the first acceptance criterion (200, text/csv, one row per finding) as MET and the second one (404 for an unknown id) as NOT MET, citing `src/reviews.mjs` with a line reference that shows there is no 404 path (e.g. `reviews.get(id)` used without a check), and quotes the criteria verbatim from the plan.
FAIL if the 404 criterion is marked MET or PARTIAL, if it trusts the implementer's claim without citing the code, or if there is no per-criterion status.
