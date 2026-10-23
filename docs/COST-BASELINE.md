# Cost baseline

Cost and quality of a fixed SDD scenario, before and after one optimization. Numbers come
from Claude Code's own run result (`total_cost_usd`, `duration_ms`, `modelUsage`), not
estimates.

## Setup

| | |
|---|---|
| Plugin | `sdd-engineering` (with `research-tools`, `architecture-review`, `engineering-paved-path`) |
| Baseline | `main` @ `0a2188a` — `sdd-engineering` 1.1.0 |
| Candidate | `perf/spec-creator-dedupe` @ `60e9738` — baseline + one change (below) |
| Model | `claude-opus-5-5` for the session and for `spec-creator` (its frontmatter); not changed between runs |
| Claude Code | 2.1.308, headless `claude -p`, Windows |
| Plugins | all four loaded from the commit via `--plugin-dir`; installed copies disabled for the run; init event: no `plugin_errors` |
| Eval set | `spec-creator-requires-ac-per-requirement`, `spec-creator-stays-in-specs` (`plugins/sdd-engineering/evals/`), 3 runs each, fresh git repo per run |
| Date | 2026-10-23 |

A "successful workflow" is a run that passes every check of its case: the agent was
dispatched, the spec file was written where expected, and the case's content checks hold
(EARS ACs, `Status: draft`, `AC missing:` with no invented limit, the `Spec INCOMPLETE`
reply, no code file). The checks mirror the case's `graders/`, applied mechanically by
[`scripts/cost/analyze.cjs`](../scripts/cost/analyze.cjs); `reported-incomplete` requires
the literal `INCOMPLETE` that `spec-creator`'s "Final message" section prescribes.

**Cost per successful workflow** = total cost of all runs ÷ number of successful runs.

## Results

| | Baseline | Candidate | Change |
|---|---|---|---|
| Pass rate | **6/6** | **5/6** | −1 run (see "Critical errors") |
| Median cost per run | $0.384 | $0.363 | −5.4 % |
| Median latency per run | 75.5 s | 70.5 s | −6.6 % |
| **Cost per successful workflow** | **$0.385** | **$0.442** | **+15 %** (one failed run) |
| Total cost (6 runs) | $2.308 | $2.210 | −4.3 % |
| Median tokens — input / output | 11 / 7 011 | 10 / 6 864 | — |
| Median tokens — cache read / cache write | 129 806 / 30 112 | 104 043 / 29 352 | — |
| Median API calls (main session) | 4.5 | 4 | — |
| Median tool calls (main session) | 3.5 | 3 | — |

Per case:

| Case | Baseline: pass, median cost (range), median latency | Candidate: pass, median cost (range), median latency |
|---|---|---|
| `requires-ac-per-requirement` | 3/3, $0.387 ($0.358–0.407), 75 s | 2/3, $0.382 ($0.370–0.406), 71 s |
| `stays-in-specs` | 3/3, $0.381 ($0.380–0.395), 79 s | 3/3, $0.349 ($0.346–0.356), 64 s |

API and tool calls count the main session's calls; `spec-creator`'s own calls run inside
the `Agent` call and are included in cost and tokens, not in these counts.

<details>
<summary>Every run</summary>

| Set | Case | Run | Result | Cost $ | Latency s | Input | Output | Cache read | Cache write | API calls | Tool calls |
|---|---|---|---|---|---|---|---|---|---|---|---|
| base | requires-ac-per-requirement | run1 | pass | 0.407 | 66 | 10 | 6752 | 97009 | 38917 | 4 | 3 |
| base | requires-ac-per-requirement | run2 | pass | 0.387 | 75 | 10 | 7836 | 106809 | 30184 | 4 | 3 |
| base | requires-ac-per-requirement | run3 | pass | 0.358 | 75 | 10 | 6661 | 106905 | 29144 | 4 | 3 |
| base | stays-in-specs | run1 | pass | 0.395 | 79 | 12 | 7564 | 152921 | 30450 | 5 | 4 |
| base | stays-in-specs | run2 | pass | 0.380 | 81 | 12 | 6992 | 152838 | 29887 | 5 | 4 |
| base | stays-in-specs | run3 | pass | 0.381 | 73 | 12 | 7030 | 152706 | 30039 | 5 | 4 |
| candidate | requires-ac-per-requirement | run1 | pass | 0.406 | 75 | 10 | 7784 | 99718 | 34464 | 4 | 3 |
| candidate | requires-ac-per-requirement | run2 | pass | 0.370 | 70 | 10 | 7187 | 104040 | 29522 | 4 | 3 |
| candidate | requires-ac-per-requirement | run3 | **FAIL** | 0.382 | 71 | 10 | 7649 | 104045 | 29872 | 4 | 3 |
| candidate | stays-in-specs | run1 | pass | 0.349 | 64 | 10 | 6262 | 104012 | 29008 | 4 | 3 |
| candidate | stays-in-specs | run2 | pass | 0.356 | 72 | 10 | 6540 | 104125 | 29181 | 4 | 3 |
| candidate | stays-in-specs | run3 | pass | 0.346 | 63 | 12 | 5625 | 149661 | 28804 | 5 | 4 |

</details>

## Critical errors

- **None in the baseline.** No plugin load errors, crashes or turn-limit hits in either set.
- **Candidate, `requires-ac-per-requirement` run3 — final-message format.** The behaviour
  was right: the spec stayed `draft`, recorded `AC missing:` for the rate limit, invented no
  numbers, and even wrote a `Spec INCOMPLETE` line into the spec. But the agent's final
  message opened with "The draft spec is written, but it is incomplete…" instead of the
  required first line `Spec INCOMPLETE: <n> mandatory requirement(s)…`. A caller that keys
  on that line would miss it. Not a false negative on the spec itself, but a regression in
  the reply contract that 1.1.0 introduced; 3/3 baseline runs produced the line.

## The optimization

One change, nothing else: [`spec-creator.md`](../plugins/sdd-engineering/agents/spec-creator.md)
stated several rules two or three times — the write path (intro, "Where the spec goes",
Hard rules), "English only" (three places), EARS / `Verify:` / Traceability rules again in
the Final self-check. The candidate states each rule once and turns the self-check into
pointers back to the sections: **2 167 → 1 724 words (−20 %)**, no rule removed. Model,
routing, tools and the eval set are unchanged.

(The lab's suggested change — moving detail out of agent prompts into skill references
loaded on demand — doesn't apply cleanly here: `spec-creator` has no `Skill` tool and its
detail is the spec format itself, which it needs on every run.)

## Verdict

**Not adopted.** The optimization passes only if the quality gate stays green, no critical
false negative appears, and cost or latency really drops. Here:

- **Quality gate: not green** — 5/6 against 6/6, one run lost the `Spec INCOMPLETE` first
  line. With 3 runs per case this may be chance, but it can't be ruled out.
- **Cost: within noise for the case that matters.** `requires-ac-per-requirement` moved
  $0.387 → $0.382 with overlapping ranges ($0.358–0.407 vs $0.370–0.406).
- **`stays-in-specs` got cheaper (−8 %, non-overlapping ranges), but not because of the
  prompt.** Baseline runs made one more main-session call (5 vs 4), which re-reads the
  conversation from cache (≈153 k vs ≈104 k cache-read tokens). That is the orchestrating
  session's behaviour, not the 443 fewer words in the agent prompt; the one candidate run
  that also made 5 calls cost $0.346, the same as the others.
- **Cost per successful workflow got worse**: $0.385 → $0.442, because of the failed run.

The 20 % shorter prompt is worth roughly 600 tokens per `spec-creator` call, which is under
1 % of a run's ~165 k tokens — too small to see against run-to-run variance at this sample
size. The baseline stays as is; the candidate is kept on `perf/spec-creator-dedupe` for
reference.

**Next candidate** (not tried here): the cost is dominated by cache reads of the main
session and by `spec-creator`'s output (~7 k tokens per spec). Tightening the spec template
(fewer mandatory sections for a small feature) targets the output directly.

## Reproduce

```sh
git worktree add --detach /tmp/base 0a2188a
git worktree add --detach /tmp/cand 60e9738
bash scripts/cost/run.sh /tmp/base out/base 3 spec-creator-requires-ac-per-requirement spec-creator-stays-in-specs
bash scripts/cost/run.sh /tmp/cand out/cand 3 spec-creator-requires-ac-per-requirement spec-creator-stays-in-specs
node scripts/cost/analyze.cjs out/base > base.json
node scripts/cost/analyze.cjs out/cand > cand.json
```

`run.sh` loads the plugins from the given checkout and disables installed copies of the
same plugins for the run. `MODEL=` overrides the session model. Costs are the API-price
equivalent Claude Code reports, also on a subscription.
