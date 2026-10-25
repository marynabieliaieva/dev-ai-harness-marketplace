#!/usr/bin/env bash
# PreToolUse gate for PR bodies written with the pr-description skill.
# Registered in hooks/hooks.json for Bash and the MCP create/update pull request tools.
#
# Inactive unless PR_DESCRIPTION_GH_HOST is set (e.g. github.com or github.<company>.net).
# Then a `gh pr create` / `gh pr edit` or an MCP create/update that supplies a body, in a repo
# whose origin contains that host, is denied unless the body has the `> **Logic:**` stat line
# and a `## Test this branch` section. Everything else passes untouched.
#
# Exit 0 without output = no opinion; exit 2 + stderr = deny.
set -euo pipefail

[ -n "${PR_DESCRIPTION_GH_HOST:-}" ] || exit 0

input="$(cat)"

# Fast path: most Bash calls are not PR commands, so skip starting node for them.
case "$input" in
  *"gh pr create"*|*"gh pr edit"*|*_pull_request*) ;;
  *) exit 0 ;;
esac

exec node "$(dirname "$0")/check-pr-body.mjs" <<<"$input"
