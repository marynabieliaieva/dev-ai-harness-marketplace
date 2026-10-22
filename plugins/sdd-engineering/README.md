# sdd-engineering

Spec Driven Development for Claude Code: a feature goes from a reviewed spec to a verified
implementation through four agents with narrow, enforced responsibilities, an orchestrator
that runs the execution loop, and a retrospective that turns each run into concrete
improvements. Every hand-off is a file, so no agent depends on another's context, and you
approve the spec and the plan before any code is written.

```sh
claude plugin install sdd-engineering@dev-digest-ai-marketplace
```

## Dependencies

Installing it also enables the three plugins it builds on:

| Plugin | Used for |
|---|---|
| [`research-tools`](../research-tools) | `spec-creator` and `implementation-planner` delegate fact-finding to `research-tools:researcher`, one question per researcher, several in parallel |
| [`architecture-review`](../architecture-review) | `run-plan` step 3: `architecture-review:architecture-reviewer` in a review ⟲ fix ⟲ re-review loop |
| [`engineering-paved-path`](../engineering-paved-path) | `engineering-paved-path:skill-routing` decides which skills apply to each file; the planner lists them per task (`digest`/`full`), `implementer` applies them while writing |

## Components

| Component | Kind | Writes | Role |
|---|---|---|---|
| `spec-creator` | agent (opus) | only `specs/<slug>/spec.md` | Turns a request and design sources into a testable spec with EARS acceptance criteria; asks about gaps, edge cases, cross-module interaction and UX instead of guessing; won't finish while a mandatory requirement has no AC |
| `implementation-planner` | agent (opus) | only `docs/plans/<slug>.md` | Turns an approved spec into tasks with owned paths, measurable ACs, key constraints, the project's own check commands, a DAG and skills per task; asks single- vs. multi-agent mode |
| `implementer` | agent (sonnet) | only its task's owned paths | Executes one task (or one fix task), applies the routed skills, self-verifies with the targeted Done-condition, ≤3 fix cycles |
| `plan-verifier` | agent (sonnet) | nothing | Checks every AC and Done-condition against the real code: MET / PARTIAL / NOT MET / CANNOT VERIFY, with `file:line` evidence |
| `/sdd-engineering:run-plan` | skill (user-only) | nothing itself | Orchestrates implementer waves → verification ⟲ fix → architecture review ⟲ fix → final full run |
| `/sdd-engineering:workflow-retro` | skill (user-only) | `docs/retro/ledger/` | Retrospective of a finished run: tokens, agents, fix loops, escapes, ranked proposals |
| `engineering-insights` | skill | `INSIGHTS.md` of the touched package | Files a non-obvious learning where the next session will find it |
| path guard | `PreToolUse` hook | — | Blocks `spec-creator` and `implementation-planner` from writing anything but their one artifact |

## Quick start

```sh
# 1. Spec — run as the main agent so it can ask you questions
claude --agent sdd-engineering:spec-creator
#    → specs/2026-10-22-invoice-export/spec.md; review it, then set "Status: approved"

# 2. Plan — refuses a spec that isn't approved
claude --agent sdd-engineering:implementation-planner
#    → docs/plans/invoice-export.md; review it

# 3. Execute — in a fresh session
claude
```

```text
/sdd-engineering:run-plan docs/plans/invoice-export.md
/sdd-engineering:workflow-retro invoice-export          # optional, after the run
```

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

- Stages 1 and 2 are manual on purpose: you review and approve each artifact.
- `plan-verifier` runs **before** the architecture review, so missing ACs are fixed first.
- `architecture-reviewer` checks layer and package boundaries only. Bugs and security are
  found by a code review — pass `--review`, or run one before the PR; `run-plan` says in
  its report when none has run.
- No agent issues a merge verdict; they supply evidence, you decide.

### Artifacts

| Artifact | Written by | Read by |
|---|---|---|
| `specs/<slug>/spec.md` | spec-creator | implementation-planner, plan-verifier |
| `docs/plans/<slug>.md` | implementation-planner | run-plan, implementer, plan-verifier |
| Execution Report (in the conversation) | implementer | run-plan, plan-verifier (accepted by change fingerprint instead of re-running tests) |
| `INSIGHTS.md` per package | engineering-insights | the next feature's planner, which distills them into key constraints |
| `docs/retro/ledger/` | workflow-retro | the next workflow-retro (trend) |

The spec header (`# Spec: … | Spec ID: SPEC-NN | Status: …`, `AC-n` IDs) and the plan
format (`Context → Check commands`, tasks, DAG) are contracts between the agents; a change
to either is a MAJOR release.

### `run-plan` arguments

| Argument | Required | Effect |
|---|---|---|
| `<plan>` | yes | `docs/plans/<slug>.md`; without it `run-plan` asks, it never guesses |
| `--spec <path>` | no — default: the `Spec:` line in the plan | handed to `plan-verifier` for requirement lookups |
| `--designs <paths…>` | no | local screenshots/exports (PNG/JPG/PDF) or a folder, handed to tasks that own UI paths; export design-tool links first |
| `--review` | no | adds a bug + security code review at the end |
| extra text | no | extra requirements; `run-plan` classifies each against the plan before running |

### `workflow-retro` arguments

`/sdd-engineering:workflow-retro [label] [--deep] [--since <ISO time>] [--session <id>]` —
run it after a workflow has **finished**. By default it works from the conversation;
`--deep` also parses the session transcripts on disk for exact token numbers. It proposes
changes and never applies them; every number states its source.

## Who runs the checks (no repeats)

Check commands come from your project — the planner finds them (a wrapper named in
`CLAUDE.md`/`AGENTS.md`, else `package.json` scripts or the language's equivalent) and
records them in the plan's `Context → Check commands`. Every Done-condition is one of
them.

| Step | What it runs |
|---|---|
| `implementer` | only its task's **targeted** Done-condition, once after all edits; ≤3 fix cycles; errors in files it doesn't own are reported, not chased. Pastes the summary, exit code, skipped count and a change fingerprint |
| `plan-verifier` | **checks the output instead of re-running**: accepts it if the exit code is 0, nothing was skipped, the fingerprint still matches and the counts are plausible; otherwise re-runs that command. Always does the cheap checks (`grep`, `diff`, `git status`) itself |
| `architecture-reviewer` | no tests — the project's architecture check if it has one, then judgment |
| `run-plan` | the plan's `Final verification`: every touched suite in full, **once**, to catch cross-task breakage |

Nobody else runs a whole suite. If a later task changed a shared file, the fingerprint no
longer matches and the verifier re-runs.

## How writing is restricted

| Agent | May write | Enforced by |
|---|---|---|
| `plan-verifier` | nothing | no Write/Edit in `tools`, plus `disallowedTools` |
| `spec-creator` | only its spec: `specs/<slug>/spec.md` | prompt + path-guard hook; no `Bash` at all |
| `implementation-planner` | only `docs/plans/<slug>.md` | prompt + path-guard hook |
| `implementer` | only its task's owned paths (never migrations, lock files, `docs/plans/**`) | prompt + `plan-verifier`'s scope checks |

The path guard is a plugin hook keyed on the hook input's `agent_type`, so it applies
whenever `spec-creator` or `implementation-planner` runs — as a subagent or with `--agent`.
Hooks don't see writes made through `Bash`; those agents are told not to use it for
writing. In a workspace you haven't trusted, hooks don't run.

## Running the agents that ask questions

`spec-creator` and `implementation-planner` ask you about gaps with `AskUserQuestion` and
call `research-tools:researcher` for facts. A subagent can neither ask you directly nor
start other subagents, so run them as the session's main agent:

```sh
claude --agent sdd-engineering:spec-creator
claude --agent sdd-engineering:implementation-planner
```

Started as a subagent instead (`@agent-sdd-engineering:spec-creator`), they do one bounded
grounding pass and return all their questions in one batch; answer them and resume the
same agent with `SendMessage` so it keeps its context. Put decisions you've already made in
the first prompt so they aren't asked again.

## What the plugin expects from your project

Nothing has to be installed in the project. The agents read what is there:

| They look for | Used for | Without it |
|---|---|---|
| `CLAUDE.md` / `AGENTS.md` (root and per package) | layout, "do not touch" list, layer rules, test commands | inferred from the repo, stated in the plan |
| test/typecheck/lint commands (`package.json` scripts, a project wrapper script, a `Makefile`) | the plan's `Check commands` → every Done-condition | the planner asks; `run-plan` refuses a plan without them |
| `.claude/skill-routing.md` | which `engineering-paved-path` skills apply to which files | the role-based default map |
| `INSIGHTS.md` per package | known pitfalls and pre-existing failures | created by `engineering-insights` on first use |
| `specs/README.md` | spec conventions | the defaults above |

Paths the plugin writes: `specs/`, `docs/plans/`, `docs/retro/ledger/` and `INSIGHTS.md`.
Agents keep scratch files in the session's scratchpad, never in the repository.

## Evals

Behavior cases for `claude plugin eval` live in [`evals/`](evals/):

| Case | Checks |
|---|---|
| `planner-refuses-draft-spec` | the planner stops at a spec without `Status: approved` |
| `spec-creator-stays-in-specs` | the spec is written to `specs/`, with EARS criteria, and no code file |
| `spec-creator-requires-ac-per-requirement` | a required behaviour with no facts gets an `AC missing:` entry, no invented number, and the spec is reported INCOMPLETE |
| `implementer-stays-in-owned-paths` | the implementer edits only its owned paths and doesn't touch tests to go green |
| `plan-verifier-flags-unmet-ac` | a deliberately unmet AC is reported NOT MET |
| `run-plan-asks-for-plan` | `run-plan` without an argument asks instead of dispatching |
| `workflow-retro-needs-finished-run` | no ledger and no invented numbers without a finished run |
| `unrelated-request-stays-idle` | an unrelated request triggers no SDD agent or skill |

Run them against the **installed** plugin, not the directory:

```sh
claude plugin eval sdd-engineering@dev-digest-ai-marketplace --scaffold --allow-tools Write Edit "Bash(node *)" "Bash(git *)"
```

A path target (`claude plugin eval .`) loads only this plugin, without its dependencies;
Claude Code then disables it as `dependency-unsatisfied`, so no `sdd-engineering` agent or
skill exists in the run and every case measures nothing. Use a project-scoped install in a
scratch project if you don't want it in your user scope.

`--scaffold` runs the cases' fixture scripts; `Bash` grants need an OS sandbox (macOS,
Linux or WSL2). Cases tagged `needs-write`/`needs-shell` need those grants.

For a quick check from the working tree, load all four plugins with `--plugin-dir`:

```sh
claude --plugin-dir ./plugins/engineering-paved-path --plugin-dir ./plugins/research-tools \
  --plugin-dir ./plugins/architecture-review --plugin-dir ./plugins/sdd-engineering
```

## Why the agents are built this way

- **Least-privilege tools, description as trigger** — Claude Code docs, *Create custom
  subagents*: each agent gets only the tools its job needs, and its `description` says
  when to use it.
- **The plan carries its own context** — Anthropic, *When to use multi-agent systems*: a
  planning/execution split loses context on hand-off unless the artifact carries it;
  hence the plan's `Context` section and per-task key constraints.
- **Sequential hand-offs use ordinary subagents** — Claude Code docs, *Orchestrate teams
  of Claude Code sessions*.
- **EARS acceptance criteria** (Mavin et al., 2009) — one syntax for testable
  requirements, traced story → AC → edge case/NFR.
- **A review agent flags, it doesn't decide** — the implementer reports what it left for
  review; verdicts stay with the reviewer and with you.
- **A mandatory self-check** instead of an optional skill call that can be silently
  skipped; an exact Done-condition command for self-verification; fresh context for
  review.

## Versions

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
