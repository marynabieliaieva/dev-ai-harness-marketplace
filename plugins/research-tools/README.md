# research-tools

A read-only `researcher` agent that answers one concrete question — from the codebase
(`git log`/`blame`, Read/Grep) or from external sources (WebSearch/WebFetch) — and
returns a cited report: Conclusions / Evidence / Sources / Could not determine. If the
question isn't answerable as asked, it returns clarifying questions instead of guessing.

```sh
claude plugin install research-tools@dev-digest-ai-marketplace
```

Use it directly (`@agent-research-tools:researcher <question>`) or from other agents:
`sdd-engineering`'s `spec-creator` and `implementation-planner` delegate to it as
`Agent(research-tools:researcher)`, one question per researcher, several in parallel.

| | |
|---|---|
| Model | sonnet |
| Tools | Read, Grep, Glob, Bash (read-only use), WebFetch, WebSearch |
| Writes | nothing |
| Network | WebSearch/WebFetch, only for external questions |

Content it reads — repository files and web pages — is treated as data, never as
instructions; anything that looks like an instruction aimed at the agent is reported, not
followed.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
