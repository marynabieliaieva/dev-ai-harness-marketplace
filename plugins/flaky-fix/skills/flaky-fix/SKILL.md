---
name: flaky-fix
description: Triage and fix one flaky test without extra pipeline or test runs — from the test name, a stack trace, the date it became flaky and its failure rate to a Jira issue, a fix branch, a reviewed commit and a PR, with verification left to the normal runs of main after merge. Invoked only by the user as /flaky-fix:flaky-fix.
argument-hint: <test name> --date YYYY-MM-DD --rate <5%|1/20> [--jira-project PROJ] [--test-file path] [--runs-per-day n] (paste the stack trace in the same message)
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/*)
disallowed-tools: WebFetch, WebSearch, NotebookEdit, Skill
---

# /flaky-fix:flaky-fix

You run one flaky-test investigation end to end. Scripts do every
deterministic step and own the run's state; two read-only agents do the
analysis and the review; you write the fix and talk to Jira/GitHub through
MCP. A guard hook enforces the same rules while the run is active
(`.flaky/ACTIVE`): if it blocks a call, read its reason and follow it —
never work around it.

Scripts: `node ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs` — always that exact
form, one script per command, nothing chained.
Patterns reference for the agents: `${CLAUDE_PLUGIN_ROOT}/skills/flaky-patterns/SKILL.md`.

## Never

- Run tests, test runners, builds or CI jobs, or ask the user to run them "to
  check". The team pays per pipeline run; verification happens on main after
  merge.
- Commit, push, switch branches or touch git state except through the scripts.
- Change what `validate.mjs` rendered (`jira-payload.json`, `pr-body.md`)
  before sending it.
- Fix with a retry, skip, sleep or bigger timeout unless the analysis and the
  patterns reference say the class has no other fix.

## 0. Inputs

Needed: test name, stack trace (pasted), date it became flaky, failure rate.
Optional: Jira project key, test file, runs of main per day. Missing any of
the four → ask for exactly what is missing and stop. Save the pasted trace
verbatim to `.flaky/incoming-stacktrace.txt` (Write).

## 1. Scope (scripts, no prompts)

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs --test "<name>" --date <date> --rate <rate> --stack-file .flaky/incoming-stacktrace.txt [--jira-project PROJ] [--test-file <path>] [--runs-per-day <n>]
node ${CLAUDE_PLUGIN_ROOT}/scripts/scope.mjs
node ${CLAUDE_PLUGIN_ROOT}/scripts/candidates.mjs
```

`intake` fetches origin and fast-forwards the default branch so the analysis
reads the latest code. It stops — and you relay the message, without fixing
it yourself — when the user is on another branch, has uncommitted changes, or
has local commits not on origin. It may also stop with several matching test
files → ask the user which one, rerun with `--test-file`. Note the run directory `.flaky/<run>/` it prints.
Tell the user in two lines: the test file, frames mapped, candidate commits
and window, and N (runs needed to close).

## 2. Analysis (agent)

Dispatch `flaky-fix:flaky-investigator` with only the run directory path and
the patterns reference path. Save its JSON reply unchanged to
`.flaky/<run>/analysis.json`, then:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/validate.mjs analysis
```

Rejected → send the agent the problem list (SendMessage to the same agent)
and save + validate again. After two rejections stop and show the user the
problems.

## 3. Ticket — first human checkpoint

Show the user: class, mechanism, top culprit with confidence (or why there is
none). Then create the Jira issue with the Jira MCP create-issue tool
(find it with ToolSearch "jira create issue" if not loaded): `summary` and
`description` exactly as in `.flaky/<run>/jira-payload.json`, project from
`--jira-project` (ask the user if none was given), type Bug unless the user
said otherwise. The guard asks the user to approve — that approval is the
checkpoint for the hypothesis. Declined → ask what is wrong; with a
correction, re-dispatch the investigator with it, revalidate, try again.
No Jira MCP connected → stop and tell the user.

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs set-jira <KEY-123>
node ${CLAUDE_PLUGIN_ROOT}/scripts/branch.mjs
```

`branch.mjs` fetches again and cuts the branch from the latest default
branch. If it reports `scopeChangedSinceIntake`, read those changes first: if
they touch the mechanism (already fixed, or changed), tell the user before
writing a fix.

## 4. Fix (you)

Following `analysis.json` (`fixApproach`, `reproIdea`) and the patterns
reference, edit the code. Edits inside the scope pass; outside it the guard
asks the user. When the class allows it, add a deterministic reproduction
test next to the flaky test. Write `.flaky/<run>/rationale.md`: why the
change makes the mechanism impossible, and what the repro test forces.
Then:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/commit.mjs
```

## 5. Review (agent)

Dispatch `flaky-fix:fix-critic` with the run directory and the patterns
reference paths. Save its JSON unchanged to `.flaky/<run>/review.json`, then
`validate.mjs review`. Verdict `revise` → fix the findings, `commit.mjs`,
critic again. `reject`, or `revise` a second time → stop: tell the user what
the critic found; the branch stays local.

## 6. Publish — second human checkpoint

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/push.mjs
```

The guard asks before the push. Then open the PR with the GitHub MCP
create-pull-request tool: owner and repo = `repo` in `state.mjs show`
(origin's), head = the run's branch, base = the `base` there without the
`origin/` prefix, title = the commit subject, body = `.flaky/<run>/pr-body.md`
unchanged. The guard denies any other repository, head or base, then asks. No GitHub MCP →
give the user the branch and the body file path to open it themselves, and
ask for the URL.

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs set-pr <url>
```

Move the issue to the team's verification status with the Jira MCP
transition tool (the guard asks), then close the run:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs verifying
```

## 7. Report

Jira key, PR link, class and culprit with confidence, and the closing rule
from `budget.json`: N green runs of the test on main, ≈ days. Say plainly
that the fix was not run before merge.

## Stopping early

The user stops, or a step can't continue → `node ${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs finish --abandon`
and say what exists (ticket, local branch). A new run can't start while
another is active.
