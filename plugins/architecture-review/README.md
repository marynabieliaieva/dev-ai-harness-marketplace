# architecture-review

A read-only `architecture-reviewer` agent that checks a diff (or named paths) against the
**project's own** architecture rules and returns evidence-cited findings:
`file:line` + verbatim quoted line + rule id + severity, or `ARCHITECTURE_CLEAN`.

```sh
claude plugin install architecture-review@dev-digest-ai-marketplace
```

Installing it also enables `engineering-paved-path`, whose `onion-architecture` and
`frontend-ui-architecture` skills hold the full rule sets.

## How it decides what to check

It builds a rule profile from the project before reviewing:

| Rule ids | Source | Applied when |
|---|---|---|
| P1 | rules stated in `CLAUDE.md` / `AGENTS.md` / an architecture doc | always, if the project states any |
| A1–A6, B1 | onion / ports-and-adapters backend | the project declares that architecture, or `.claude/skill-routing.md` routes backend files to `onion-architecture` |
| F1–F4 | feature-based frontend structure | the project declares it, or routes client files to `frontend-ui-architecture` |
| X1–X3 | cross-package imports (pure packages, relative cross-package paths, shared contracts) | always |
| D1–D2 | "do not touch" — migrations, lock files, the project's own list | always |

If the project has an architecture-check command or `scripts/arch-check.sh`, it runs that
first and only confirms its hits. It never creates such a script or a
`.dependency-cruiser.js`.

## Modes

- **Diff** (default) — merge base with the default branch plus uncommitted work; only
  added or changed lines are findings, pre-existing violations are a bare count.
- **Audit** — the caller names paths; every line in them is in scope.
- **Re-review** — after a fix round: previous findings → RESOLVED / STILL PRESENT, new
  findings only in the fixed files. `sdd-engineering:run-plan` uses this.

It checks boundaries only: no style, correctness or security review, and no merge verdict.

| | |
|---|---|
| Model | sonnet |
| Tools | Read, Grep, Glob, Bash (read-only), Skill |
| Writes | nothing |

Content evals for this agent live in the marketplace's [`evals/agents/architecture-reviewer`](../../evals/agents/architecture-reviewer).

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
