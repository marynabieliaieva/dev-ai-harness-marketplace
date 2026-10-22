# sdd-engineering

Spec Driven Development for Claude Code: a feature goes from a reviewed spec to a
verified implementation through four agents with narrow, enforced responsibilities, an
orchestrator that runs the execution loop, and a retrospective that turns each run into
concrete improvements.

```sh
claude plugin install sdd-engineering@dev-digest-ai-marketplace
```

Installing it also enables its dependencies: `research-tools`, `architecture-review` and
`engineering-paved-path`.

## Components

| Component | Kind | Writes | Role |
|---|---|---|---|
| `spec-creator` | agent (opus) | only `specs/<slug>/spec.md` | Turns a request and design sources into a testable spec with EARS acceptance criteria; asks instead of guessing |
| `implementation-planner` | agent (opus) | only `docs/plans/<slug>.md` | Turns an approved spec into tasks with owned paths, measurable ACs, the project's own check commands, a DAG and skills per task |
| `implementer` | agent (sonnet) | only its task's owned paths | Executes one task (or one fix task), self-verifies with the targeted Done-condition, ≤3 fix cycles |
| `plan-verifier` | agent (sonnet) | nothing | Checks every AC and Done-condition against the real code: MET / PARTIAL / NOT MET / CANNOT VERIFY |
| `/sdd-engineering:run-plan` | skill (user-only) | nothing itself | Orchestrates implementer waves → verification ⟲ fix → architecture review ⟲ fix → final full run |
| `/sdd-engineering:workflow-retro` | skill (user-only) | `docs/retro/ledger/` | Retrospective of a finished run: tokens, fix loops, escapes, ranked proposals |
| `engineering-insights` | skill | `INSIGHTS.md` of the touched package | Files a non-obvious learning where the next session will find it |
| path guard | `PreToolUse` hook | — | Blocks `spec-creator` and `implementation-planner` from writing anything but their one artifact |

## How it works together

```text
research-tools:researcher (ad hoc, any time)

1. manual   spec-creator            → specs/<YYYY-MM-DD>-<feature>/spec.md   → you set Status: approved
2. manual   implementation-planner  → docs/plans/<slug>.md                   (refuses a non-approved spec)
3. /sdd-engineering:run-plan docs/plans/<slug>.md [--spec] [--designs …] [--review] [extra requirements]
     0 preflight: waves from the DAG, classify extra requirements
     1 implementer ∥ … per wave              (targeted Done-condition, ≤3 fix cycles each)
     2 plan-verifier (all tasks) ⟲ fix tasks (≤2 rounds)
     3 architecture-review:architecture-reviewer ⟲ fix ⟲ re-review (≤3 rounds)
       3b plan-verifier, scoped to the tasks the fixes touched
     4 the plan's Final verification, once ⟲ fix
     5 [--review] bug + security code review
4. /sdd-engineering:workflow-retro [label] [--deep]   → docs/retro/ledger/<date>-<label>.md
```

Every hand-off is a file, so no agent depends on another's context:

| Artifact | Written by | Read by |
|---|---|---|
| `specs/<slug>/spec.md` | spec-creator | implementation-planner, plan-verifier |
| `docs/plans/<slug>.md` | implementation-planner | run-plan, implementer, plan-verifier |
| Execution Report (in the conversation) | implementer | run-plan, plan-verifier (accepted by change fingerprint instead of re-running tests) |
| `docs/retro/ledger/` | workflow-retro | the next workflow-retro (trend) |

### Running the agents that ask questions

`spec-creator` and `implementation-planner` ask you about gaps with `AskUserQuestion` and
call `research-tools:researcher` for facts. A subagent can neither ask you directly nor
start other subagents, so run them as the session's main agent:

```sh
claude --agent sdd-engineering:spec-creator
claude --agent sdd-engineering:implementation-planner
```

Started as a subagent instead (`@agent-sdd-engineering:spec-creator`), they do one bounded
grounding pass and return all their questions in one batch; answer them and resume the
same agent with `SendMessage` so it keeps its context.

## What the plugin expects from your project

Nothing has to be installed in the project. The agents read what is there:

| They look for | Used for | Without it |
|---|---|---|
| `CLAUDE.md` / `AGENTS.md` (root and per package) | layout, "do not touch" list, layer rules, test commands | inferred from the repo, stated in the plan |
| test/typecheck/lint commands (`package.json` scripts, a wrapper such as `scripts/check.sh`, a `Makefile`) | the plan's `Check commands` → every Done-condition | the planner asks; `run-plan` refuses a plan without them |
| `.claude/skill-routing.md` | which `engineering-paved-path` skills apply to which files | the plugin's default map |
| `INSIGHTS.md` per package | known pitfalls and pre-existing failures | created by `engineering-insights` on first use |
| `specs/README.md` | spec conventions | the defaults above |

Paths the plugin writes: `specs/`, `docs/plans/`, `docs/retro/ledger/` and `INSIGHTS.md`.
Agents keep scratch files in the session's scratchpad, never in the repository.

## Guarantees and their limits

- The path guard is a plugin hook keyed on the hook input's `agent_type`, so it applies
  whenever `spec-creator` or `implementation-planner` runs — as a subagent or with
  `--agent`. Hooks don't see writes made through `Bash`; those agents are told not to, and
  `spec-creator` has no `Bash` at all. In a workspace you haven't trusted, hooks don't run.
- `implementer` is held to its owned paths by its prompt and by `plan-verifier`'s scope
  checks, not by a hook.
- `architecture-reviewer` checks boundaries only. Without `--review`, no bug or security
  review has run — `run-plan` says so in its report.

## Evals

Behavior cases for `claude plugin eval` live in [`evals/`](evals/). Run them against the
**installed** plugin, not the directory:

```sh
claude plugin eval sdd-engineering@dev-digest-ai-marketplace --scaffold --allow-tools Write Edit "Bash(node *)" "Bash(git *)"
```

A path target (`claude plugin eval .`) loads only this plugin, without its dependencies;
Claude Code then disables it as `dependency-unsatisfied`, so no `sdd-engineering` agent or
skill exists in the run and every case measures nothing. Installing the plugin installs
`research-tools`, `architecture-review` and `engineering-paved-path` with it. Use a
project-scoped install in a scratch project if you don't want it in your user scope.

`--scaffold` runs the cases' fixture scripts; `Bash` grants need an OS sandbox (macOS,
Linux or WSL2). Cases tagged `needs-write`/`needs-shell` need those grants.

For a quick check from the working tree, load all four plugins with `--plugin-dir`:

```sh
claude --plugin-dir ./plugins/engineering-paved-path --plugin-dir ./plugins/research-tools \
  --plugin-dir ./plugins/architecture-review --plugin-dir ./plugins/sdd-engineering
```

## Versions

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
