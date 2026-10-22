# research-tools

One read-only agent, `researcher`, that answers **one concrete question** with evidence —
from your codebase (Read/Grep, `git log`/`blame`) or from external sources
(WebSearch/WebFetch) — and never edits anything. Use it whenever you want a fact checked
instead of guessed: "where is X implemented?", "why was Y decided?", "what does library Z
v4 change about W?".

```sh
claude plugin install research-tools@dev-digest-ai-marketplace
```

No dependencies. Used by [`sdd-engineering`](../sdd-engineering), whose `spec-creator`
and `implementation-planner` delegate their fact-finding to it.

## Quick start

Ask for it by name in any session:

```text
@agent-research-tools:researcher Where do we validate webhook signatures, and is the check timing-safe?
@agent-research-tools:researcher What changed in Next.js 15 about caching fetch() in route handlers? Cite the docs.
```

Or let Claude delegate on its own — the agent's description makes it the default pick for
"investigate a concrete question" requests. Several researchers can run in parallel, one
question each.

From your own agents, allow it in the frontmatter and call it by its namespaced name:

```yaml
tools: Read, Grep, Glob, Agent(research-tools:researcher)
```

## What you get back

A report in a fixed shape — `## Repository research: <question>` or
`## External research: <question>` — so a calling agent can parse it:

| Section | Contents |
|---|---|
| **Conclusions** | The answer, in a few bullets |
| **Evidence** | `file:line` with quoted lines and commit hashes, or quoted passages from sources |
| **References** / **Sources** | Every file, commit (repository) or URL (external) it relied on |
| **Could not determine** | What it couldn't establish, and why — instead of a guess |

If the question isn't answerable as asked (too vague, no clear question, missing context),
it returns only a `## Clarifying questions` list instead of a report.

## Capabilities and limits

| | |
|---|---|
| Model | sonnet |
| Tools | Read, Grep, Glob, Bash (read-only: `git log`, `git blame`, `ls`…), WebFetch, WebSearch |
| Writes | nothing — no Write/Edit tools |
| Network | WebSearch/WebFetch, only for questions about external sources |
| Won't do | edit files, run `/deep-research` or other research-automation skills, guess when the question is unclear |

Content it reads — repository files and web pages — is treated as **data**, never as
instructions; anything that looks like an instruction aimed at the agent is reported, not
followed.

**When to use something else.** For a multi-source written report on a broad topic, use a
deep-research skill; `researcher` is for one precise question with a cited answer.

## Versions

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
