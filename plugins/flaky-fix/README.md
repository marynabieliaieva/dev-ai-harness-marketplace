# flaky-fix

Takes one flaky test from "it fails sometimes" to a Jira issue, a fix branch, a reviewed
commit and a PR, **without running the test or a pipeline even once**. It is built for teams
where every pipeline run costs money: the evidence is the stack trace, the code and git
history, and verification happens on the normal runs of main after merge.

```sh
claude plugin install flaky-fix@dev-digest-ai-marketplace
```

```text
/flaky-fix:flaky-fix OrderServiceTest#createsOrder --date 2026-10-20 --rate 1/20 --jira-project SHOP
<paste the stack trace>
```

## Who does what

Deterministic steps are scripts, judgment is the model, and outward actions wait for the
user. Every hand-off is a file in `.flaky/<run>/` (kept out of git through
`.git/info/exclude`), so each step can be checked and a run can be resumed.

| Step | Who | Output |
|---|---|---|
| Fetch origin, fast-forward the default branch, validate inputs, find the test file, compute N | `intake.mjs` | `input.json`, `budget.json` |
| Map stack frames to files, collect imports, manifests, test config, CI config | `scope.mjs` | `frames.json`, `scope.json` |
| Commits in the window that touch the scope + tests newly added next to it | `candidates.mjs` | `candidates.json` |
| Classify the mechanism, rank culprits, draft the Jira text | `flaky-investigator` agent (opus, read-only) | `analysis.json` |
| Check the analysis, render the Jira text | `validate.mjs analysis` | `jira-payload.json` |
| Create the issue | you, through Jira MCP (**asks the user**) | issue key |
| Fetch again, fix branch from the latest default branch, flag scope files changed since intake | `branch.mjs` | `fix/<KEY>-flaky-<test>` |
| Write the fix, a deterministic repro test and the rationale | main session | code, `rationale.md` |
| Commit, scan for masking changes | `commit.mjs` | commit, `masking.json`, `fix.diff` |
| Does the fix remove the mechanism? Answer every masking hit | `fix-critic` agent (sonnet, read-only) | `review.json` |
| Check the review, render the PR body | `validate.mjs review` | `pr-body.md` |
| Push to origin (no force), record origin's owner/repo | `push.mjs` (**asks the user**) | remote branch |
| Open the PR, move the issue to verification | you, through GitHub/Jira MCP (**each asks**) | PR, status |

**N** is the number of consecutive green runs on main that close the issue: the smallest N
with `(1 − p)^N ≤ 0.05`, about `3 / p`. At a 5% failure rate that is 59 runs; at 1%, 299.
Pass `--runs-per-day` to get the expected number of days in the ticket.

## Safety model

| Concern | How it is enforced |
|---|---|
| The workflow starts on its own | The orchestrator skill has `disable-model-invocation: true`: only the user can start it. `flaky-patterns` is reference material (`user-invocable: false`); loading it does nothing. |
| An agent does more than its job | Both agents have `tools: Read, Grep, Glob` and an explicit `disallowedTools` list. An agent with an explicit `tools` list gets no MCP tools. Plugin agents can't declare `hooks`, `mcpServers` or `permissionMode`, so they can't widen this. |
| The skill does more than its job | `allowed-tools` only pre-approves (the plugin's scripts, reads); it never restricts. `disallowed-tools` removes web access, notebooks and other skills while the skill is active. The hard limits are the guard hook's. |
| Extra pipeline/test runs | The guard denies test runners, CI triggers (`gh workflow run`, Jenkins `/build`, …), network tools and package installs while a run is active. |
| Stale code | `intake.mjs` fetches origin and fast-forwards the default branch before anything is read; it refuses to start on another branch, with uncommitted changes or with unpushed local commits, and never switches or resets on its own. `branch.mjs` fetches again and cuts the fix branch from the latest default branch, listing scope files that changed since the analysis. |
| PR in the wrong repository | The create-PR call must name origin's owner/repo (recorded by `push.mjs` from `git remote get-url origin`), the run's branch as head and the default branch as base; a missing or different value is denied. |
| Git damage | Raw git writes are denied during a run. `commit`/`push` happen only through scripts that check the stage; `push.mjs` never forces and pushes only the run's branch at the reviewed commit. |
| Edits in the wrong place | No code edits before the fix branch exists, none after the review. Within the test's scope (test file, stack-trace files, their imports, the test's directory) they pass; outside they ask. The run's state files can only be written by the scripts. |
| MCP writes | Read tools pass. Exactly four writes are possible: create issue, create PR, transition, comment. Each **asks the user** and only at its stage, with the text the scripts rendered (summary and run marker checked, project key and PR head checked). Any other MCP write (update, delete, merge, assign, push files…) is denied during a run. |
| Hook failure | Outside a run the guard exits at once and never blocks anything. During a run it fails closed. A broken run is ended by deleting `.flaky/ACTIVE`. |

### Why prompts only at the outward actions

The run asks the user at most four times (issue, push, PR, transition), all after the
analysis, so the long part — scoping, analysis, fix, review — runs unattended. Those four are
the points where a mistake becomes visible to other people or hard to undo. Asking also on
reads or local steps would add prompts without protecting anything: local steps are
reversible and checked by the scripts. The issue-creation prompt doubles as the review of the
hypothesis, so there is no separate "do you agree" question.

A hook's `ask` forces a prompt even in auto mode. Its behavior under `bypassPermissions` and
in headless `-p` runs without a permission-prompt tool is not documented: don't run this
skill in those modes. Hook `deny` (exit 2) blocks the call.

## Requirements

- Node.js 22+ and git on `PATH`; an `origin` remote you can fetch from and push to. Start
  on the default branch with a clean working tree.
- A Jira MCP server with create-issue and transition tools; a GitHub MCP server with
  create-pull-request. Without GitHub MCP the skill stops after the push and gives you the
  branch and PR body to open the PR yourself. This plugin ships no MCP config and contacts no
  host itself; `intake.mjs`, `branch.mjs` and `push.mjs` use your git remote `origin`.

The guard recognises MCP tools by the action name (`create…issue`, `create…pull_request`,
`transition…`, `add…comment`, read verbs such as `get`/`list`/`search`), so it works with
Atlassian's and GitHub's servers and most others. A server whose write tools are named
differently is denied during a run, which is the safe failure.

## Limits

- The culprit is a hypothesis with a confidence, not a bisect result.
- Stack frames are mapped for JVM, Python, JS/TS, .NET, Go and Ruby traces. Imports are
  followed for JS/TS, Python and JVM files.
- One active run per working copy.
