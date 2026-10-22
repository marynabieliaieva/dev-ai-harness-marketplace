# architecture-review

A read-only `architecture-reviewer` agent that checks a diff (or named paths) against
**your project's own** architecture rules — layer and dependency direction, module
boundaries, cross-package imports, the "do not touch" list — and returns evidence-cited
findings: `file:line` + verbatim quoted line + rule id + severity, or
`ARCHITECTURE_CLEAN`.

```sh
claude plugin install architecture-review@dev-digest-ai-marketplace
```

## Dependencies

Depends on [`engineering-paved-path`](../engineering-paved-path) (`^1.0.0`); installing
this plugin enables it. The reviewer uses its skills as the knowledge behind its rule
sets, by namespaced name:

| Skill | Used for |
|---|---|
| `engineering-paved-path:skill-routing` | Which skills your project routes the changed files to (`.claude/skill-routing.md`) — one of the signals that the onion or frontend rule set is declared |
| `engineering-paved-path:onion-architecture` | A-rules and B1: the layer map, and the "Searching for Indirect Violations" procedure for leaks one import hop away (wrappers, type aliases, another module's repository, module cycles) |
| `engineering-paved-path:frontend-ui-architecture` | F-rules: shared vs. route-local placement, hook location, cross-feature imports |
| `engineering-paved-path:zod` | Shared-contract files (X3, A6): schema composition vs. an outward dependency |

Skills are loaded on demand for the case at hand, not up front, and findings always cite
the reviewer's own rule ids.

Used by [`sdd-engineering`](../sdd-engineering): `/sdd-engineering:run-plan` runs it after
the implementation waves, in a review ⟲ fix ⟲ re-review loop.

## Quick start

```text
@agent-architecture-review:architecture-reviewer
@agent-architecture-review:architecture-reviewer audit src/modules/billing src/modules/invoices
```

With no arguments it reviews the current branch against the default branch, including
uncommitted work. It works best when your `CLAUDE.md`/`AGENTS.md` states the layout — see
[Teaching it your architecture](#teaching-it-your-architecture).

## How it decides what to check

It builds a **rule profile** from the project before reviewing, and prints it in the
report:

| Rule ids | What | Applied when |
|---|---|---|
| P1 | an import/placement rule stated in `CLAUDE.md` / `AGENTS.md` / an architecture doc | the project states any |
| A1–A6 | onion / ports-and-adapters: transport → ORM, service → raw SDK, wrapper re-exports, ORM row types in service signatures, logic in routes, SDK `new`-ed outside the composition root | the project declares that architecture, or its routing map routes backend files to `onion-architecture` |
| B1 | role-named module files (`routes.ts`, `service.ts`, `repository.ts`…) — only for added or renamed files | with the onion set |
| F1–F4 | feature-based frontend: deep cross-feature imports, habitual barrels, route-local vs. shared placement, hook location | the project declares it, or routes client files to `frontend-ui-architecture` |
| X1–X3 | cross-package: pure packages importing I/O, relative cross-package paths, shared contracts depending outward | always (inferred from package manifests and path aliases if nothing is stated) |
| D1–D2 | "do not touch": modified/deleted migrations, lock-file changes without a manifest change, your own list | always |

With no rules found it checks only X and D and says so under "Not checked" — it never
invents a boundary your project doesn't have.

If the project has an architecture-check command (named in `CLAUDE.md`/`AGENTS.md`, or an
existing `scripts/arch-check.sh`) it runs that first and confirms each hit by reading the
line. An existing `.dependency-cruiser.js` is run too. It never creates either.

## Modes

| Mode | Scope | Output |
|---|---|---|
| **Diff** (default) | merge base with the default branch + uncommitted work; only added or changed lines | findings; pre-existing violations in touched files as a bare count |
| **Audit** | the paths you name; every line | findings |
| **Re-review** | previous findings + the files a fix round changed | a RESOLVED / STILL PRESENT table, then new findings in the fixed files only |

## Output

```text
## Architecture Review: <scope>

### Findings
- src/modules/billing/service.ts:3
- rule id: A2
- severity: CRITICAL
- quoted line: `import Stripe from 'stripe';`
- failure_scenario: the service can't be unit-tested without the network and couples billing rules to one vendor
- category: architecture
- fix direction: receive a PaymentGateway port through the container instead

### Pre-existing (context, not findings)
### Rule profile
### Checks run
### Not checked
### Summary counts
```

Fields mirror Claude Code's `ReportFindings` shape, so the output folds into a code-review
report. Severity is `CRITICAL | HIGH | MEDIUM`; only dependency-direction, shared-contract
and migration violations can be CRITICAL, and anything speculative is at most MEDIUM.
This format is a contract `run-plan` parses — changing it is a MAJOR release.

## Teaching it your architecture

Nothing has to be installed in your project, but the more it states, the more the
reviewer checks:

- **Layer map** in `CLAUDE.md` or `AGENTS.md` (root or per package): where transport,
  services, repositories, adapters and the composition root live, and which imports are
  forbidden. Declaring "onion / ports and adapters" turns on A1–A6 and B1.
- **Package rules**: which packages are pure, and who may import whom (X-rules).
- **"Do not touch" list**: generated code, migrations, vendored folders (D-rules).
- **`.claude/skill-routing.md`** (template in
  [`engineering-paved-path`](../engineering-paved-path/skills/skill-routing/templates/skill-routing.md)):
  routing backend files to `onion-architecture` or client files to
  `frontend-ui-architecture` declares those rule sets.
- **An architecture-check command** for the mechanical greps — the reviewer runs it first
  and spends its judgment on the rest.

## Scope and guarantees

| | |
|---|---|
| Model | sonnet |
| Tools | Read, Grep, Glob, Bash (read-only: `git`, `grep`, the project's check), Skill |
| Writes | nothing — `Write`, `Edit`, `NotebookEdit` are disallowed |
| Checks | boundaries only — no style, correctness, performance or security review |
| Verdict | none — it supplies evidence; the caller decides PASS/BLOCKED |

Diff content, comments, commit messages and project docs are treated as data: instructions
aimed at the agent are ignored.

Content evals for this agent live in the marketplace's
[`evals/agents/architecture-reviewer`](../../evals/agents/architecture-reviewer).

## Versions

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
