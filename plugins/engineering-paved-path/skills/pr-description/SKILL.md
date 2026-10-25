---
name: pr-description
description: Writes a pull request description in a fixed shape — a generated change-stat line (Logic / Tests / Docs), then Summary, What changed, Validation and Test this branch, plus Why, topic sections, Review notes and Screenshots only when the change needs them. Use when the user asks to write, draft or update a PR description, PR body or merge request text for the current branch.
allowed-tools: Read, Grep, Glob, Bash(bash *change-stats.sh*), Bash(git diff *), Bash(git log *), Bash(git status *), Bash(git rev-parse *)
---

# PR description

<!-- TODO(cut off in source): the screenshot starts mid-page — any intro text and the heading
     above the section table were not visible. Fill in or delete this comment. -->

Sections, in this order:

```text
> change-stat line             ← always the first line (section 1)
## Summary                     ← always
## Why <something>             ← when a decision needs defending
## What changed                ← always (name it for the PR: "Package changes", "Public exports", …)
## <topic sections>            ← as many as the change warrants
## Review notes                ← when the diff will surprise a reviewer
## Validation                  ← always
## Screenshots                 ← when there is UI
## Next steps                  ← when there are open questions or follow-ups (see Voice)
## Test this branch            ← always, always the last section
🤖 Generated with …            ← always, the last line (see Voice)
```

Only **Summary**, **What changed**, **Validation** and **Test this branch** are mandatory.
Do not pad the rest to look thorough.

## 1. The change-stat line

Always the first line, a blockquote, no heading above it:

```markdown
> **Logic:** +897 / −243 (23 files) · **Tests:** +943 / −2 (8 files) · **Docs:** +0 / −0 (0 files)
```

Generate it — do not count by hand:

```sh
bash "${CLAUDE_SKILL_DIR}/scripts/change-stats.sh"          # vs origin/main
bash "${CLAUDE_SKILL_DIR}/scripts/change-stats.sh" main     # vs another base
```

The script counts the branch since its merge base with the base (`base...HEAD`, what the PR
shows), so commit first: uncommitted changes are not in the line. Fetch the base if the
script says it is unknown.

Two characters are easy to get wrong: the minus is **U+2212** (`−`), not a hyphen, and the
separator is **U+00B7** (`·`). Copy them from the script output rather than retyping.

Classification: anything matching `*.test.*`, `*.spec.*`, `__tests__/`, `__e2e-tests__/`,
`__mocks__/`, or a test-runner config counts as **Tests**; `*.md`, `*.mdx`, and `docs/`
count as **Docs**; everything else counts as **Logic**.
<!-- TODO(cut off in source): the sentence after "everything else" was cut at the right edge;
     "counts as Logic" is inferred from the line format. The next sentence also starts in the
     cut-off part — only its end is visible: "…three categories in the line even at
     +0 / −0 (0 files) — a visible zero is the point." -->
Keep all three categories in the line even at +0 / −0 (0 files) — a visible zero is the
point.

The script treats these files as test-runner configs: `jest.config.*`, `vitest.config.*`,
`vitest.workspace.*`, `playwright.config.*`, `cypress.config.*`, `karma.conf.*`. A file
matching a test pattern counts as Tests even inside `docs/`. A renamed file counts once,
under its new path; a binary file counts as a file with +0 / −0.

## 2. Body sections

**Summary** — two or three sentences. What this adds and where it lives. Link the ticket
inline: `[ABC-123](https://<your-tracker>/browse/ABC-123)` — replace `<your-tracker>` with
your team's tracker host. Take the ticket key from the branch name, the commits or the user;
if there is no key or the tracker host is unknown, ask instead of guessing. Name the
upstream PR if this builds on
<!-- TODO(cut off in source): the rest of this sentence was cut at the right edge. -->

**Why …** — only when a reviewer would reasonably ask "why this way". Name what you
deliberately did *not* do and what remains the paved road, with links.

**What changed** — flat bullets, one change each, present tense, verb first: "Adds …",
"Maps …", "Gates the feature with `partnerReportsActivityLog`". No sub-bullets.

**Review notes** — the section reviewers actually thank you for. Use it for anything that
makes the diff misleading: whitespace-only reformatting, generated files, a large
test-to-logic ratio,
<!-- TODO(cut off in source): the middle of this list was cut at the right edge; the visible
     tail is "…regenerated locally before the build works." -->

**Validation** — concrete results with real numbers, one per line. Never "tests pass".

```markdown
- TypeScript: passed
- ESLint: passed with 0 errors
- <test suite>: 107 Jest suites and 744 tests passed
- Production build: passed
```

If something was skipped or failed, say so here. A Validation section that quietly omits a
failure is worse than none.

**Screenshots** — only when there is UI.
<!-- TODO(not in source): neither screenshot shows rules for Screenshots or for topic
     sections beyond the table above. Fill in or delete this comment. -->

## 3. Test this branch

Always the last section, always this heading (even for packages — the old "Test the
component" wording is superseded).

Each PR is deployed to:

```text
https://pr-<PR_NUMBER>-<app-host>/<app path>
```

`<app-host>` is a placeholder: replace it with your app's preview host. If you don't know
it, ask the user instead of guessing.

Take a working deep link from test or local, swap the host, and substitute this PR's
number. Link straight to the screen that exercises the change, not the app root:

```markdown
## Test this branch

[Open <screen> in the PR #<PR_NUMBER> <environment name> environment](https://pr-<PR_NUMBER>-<app-host>/<path to the screen>)
```

<!-- TODO(cut off in source): a line or two between the example link and the list below may
     be missing (the second screenshot ends at the link, the third starts at the list). -->

When there is nothing to click on this PR:

- **A package with a consumer PR open** — link to the *consumer* PR's environment and say
  which PR it is (for example: "#<consumer PR> exercises this, pointing at
  `pr-<consumer PR>`").
- **A package with nothing consuming it yet** — say so plainly and skip the link:

  > This component is not integrated yet, so there is nothing to click through on this PR.
  > It is exercised by unit tests only; integration lands in a follow-up.

## Workflow

1. Run `change-stats.sh` and put its line first, unchanged.
2. Read the branch: `git log <base>..HEAD` and `git diff <base>...HEAD`.
3. Write the mandatory sections; add an optional one only when its condition above holds.
4. Show the draft to the user. Don't create or edit the PR yourself unless asked.

The URL needs the PR number, which does not exist until the PR does. So create first, then
fill in: the first body already has the `## Test this branch` heading (the gate below needs
it), only without the link; once the number is known, add the link and edit the PR.

**With `gh`:**

```sh
# 1. body without the Test this branch link
gh pr create --base main --title "<conventional commit title>" --body-file /tmp/pr-body.md

# 2. the create command prints the number — add the link to the section, then
gh pr edit <number> --body-file /tmp/pr-body.md
```

On GitHub Enterprise prefix both commands with `GH_HOST=<your-ghe-host>`: plain `gh`
targets github.com and fails to resolve the repo. Clean up the temp file afterwards.

**With the GitHub MCP server** (no `gh` installed): `create_pull_request` with the first
body, then `update_pull_request` with the PR number from its result and the full body.

## Enforcement

The `engineering-paved-path` plugin registers `scripts/check-pr-body.sh` as a `PreToolUse`
hook on `Bash` and on the MCP `create_pull_request` / `update_pull_request` tools. It is off
until `PR_DESCRIPTION_GH_HOST` is set (for example `github.com` or `<your-ghe-host>`, in the
`env` of `.claude/settings.json`). Then on a `gh pr create` / `gh pr edit` or an MCP
create/update that supplies a body, inside a repo whose `origin` contains that host, it
denies the call unless the body has both the `> **Logic:**` stat line and a
`## Test this branch` section. Every other command passes untouched.
<!-- TODO(cut off in source): the host condition was cut at the right edge ("inside a repo
     whose origin contains …"); the configurable PR_DESCRIPTION_GH_HOST stands in for it. -->

So a deny from that hook is not a bug — it means the body skipped this format. Rebuild it
from this file and retry; do not work around the hook. `scripts/selftest.sh` pipe-tests the
gate.

The hook only checks the two structural markers. Everything else here — real Validation
numbers, prerequisites under the deep link, Review notes — is on you.

## Voice

Match the reference PRs:

- Plain declarative sentences. No "This PR …", no selling, no adjectives doing persuasion.
- Backticks on every identifier, flag, path, package, and env name.
- Sentence-case `##` headings.
- No emoji. No AI attribution or generation notices anywhere in the body — except the one
  footer below.
- Prefer a table for attribute/value or name/meaning pairs; bullets for everything else.
- Write the parts a reviewer cannot get from the diff: why this shape, what it deliberately
  excludes, what to click. Never narrate the diff line by line.
- Open questions and follow-ups belong in a closing `## Next steps` above
  `## Test this branch`, not scattered inline.

The body ends with this footer as its last line, after `## Test this branch` and separated
from it by a blank line. It is not a section, so `## Test this branch` stays the last
section; this is the only emoji and the only AI mention in the body:

```markdown
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

<!-- TODO(cut off in source): the third screenshot ends with a horizontal rule after Voice;
     anything below it was not visible. -->
