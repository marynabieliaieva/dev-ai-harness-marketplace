# evals

Content and workflow evals for the marketplace's plugins — the skills and agents under
`plugins/*/`. Plain **vitest + the Claude Agent SDK**. Not shipped with any plugin.

Runs on the Claude Code **subscription**: any `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` is
stripped from the spawned processes, so calls use your login, never per-token API billing.

Two eval systems live in this repository, for different questions:

| | This engine (`evals/`) | `claude plugin eval` (`plugins/<name>/evals/`) |
|---|---|---|
| Asks | Is the artifact's *content* good? (judged per practice, with repeat/delta/benchmark statistics) | Does the *installed plugin* change behavior end to end? |
| Loads | one skill/agent injected as the system prompt, or every plugin | the plugin under test, in an isolated `claude -p` |
| Cases | `evals/{skills,agents,workflow}/<name>/*.eval.ts` | `prompt.md` + `graders/*.md` per case |

## Install

```sh
cd evals
pnpm install
```

Needs Node 22+ and a logged-in Claude Code.

## Three tiers

1. **Static gate (no model)** — `pnpm eval:quality` checks every skill's `SKILL.md`
   structure, frontmatter and links across `plugins/*/skills/`.
2. **Quality evals (LLM-judged)** — per skill/agent: `skillTask`/`agentTask` inject the
   artifact's content as the system prompt with no on-disk config, so the case measures the
   content in isolation. Agents get the read-only subset of the tools they declare.
3. **Workflow evals (trace-asserted)** — `workflowTask` loads every plugin in `plugins/`
   into the session and checks systemic behavior: does a skill activate, does a subagent
   get dispatched.

On top: **repeat** (one case N times → stability), **delta** (two labeled repeat runs →
version vs version), **benchmark** (with vs without the artifact → measured lift). All read
`results/records.jsonl`.

## Commands

```sh
pnpm eval:quality                       # static checks, no model
pnpm eval:agents                        # every agent eval
pnpm exec vitest run agents/architecture-reviewer
pnpm eval:scaffold                      # list skills/agents and whether they have evals
pnpm eval:scaffold onion-architecture   # create evals/skills/onion-architecture/…
pnpm eval:scaffold --agent implementer
pnpm eval:repeat -- <case> --runs 5
pnpm eval:benchmark
pnpm typecheck
```

Artifacts are addressed by bare name, or as `<plugin>:<name>` when two plugins share one.

## Configuration

| Variable | Default | Use |
|---|---|---|
| `EVAL_MODEL` | `claude-haiku-5-5` | model under test |
| `EVAL_JUDGE_MODEL` | `claude-sonnet-5-5` | judge for `llmJudge` |
| `EVAL_MAX_TURNS` | `8` | turn cap per run |
| `EVAL_CONFIG` | `candidate` | `baseline` runs without the artifact (benchmark) |
| `EVAL_QUIET` | unset | suppress per-run traces |

## Safety

Runs use `bypassPermissions` against this repository, so tool lists stay read-only:
`agentTask` strips `Write`, `Edit`, `NotebookEdit`, `Bash` and `Agent(...)` grants from an
agent's declared tools, and `workflowTask` allows only `Read`, `Grep`, `Glob`, `Task`,
`Agent` and `Skill`.

## Origin

Extracted from the DevDigest harness evals. Removed here: the OpenRouter/LiteLLM backend
(network and credentials), cases for components that are not in this marketplace, and the
skill-creator workspaces.
