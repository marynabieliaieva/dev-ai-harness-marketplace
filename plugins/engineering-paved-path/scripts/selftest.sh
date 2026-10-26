#!/usr/bin/env bash
# Pipe-tests check-pr-body.sh: feeds it PreToolUse payloads and checks pass (exit 0) or
# deny (exit 2). Needs bash, git and node. Usage: bash scripts/selftest.sh
set -uo pipefail

gate="$(cd "$(dirname "$0")" && pwd)/check-pr-body.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

repo="$tmp/repo"; other="$tmp/other"
git init -q "$repo" && git -C "$repo" remote add origin https://github.example.net/acme/app.git
git init -q "$other" && git -C "$other" remote add origin https://github.com/acme/app.git

good=$'> **Logic:** +1 / \xe2\x88\x920 (1 files)\n\n## Summary\n\nAdds x.\n\n## Test this branch\n\n[Open x](https://pr-1-app.example.net/x)\n'
bad_no_test=$'> **Logic:** +1 / \xe2\x88\x920 (1 files)\n\n## Summary\n\nAdds x.\n'
bad_no_stat=$'## Summary\n\nAdds x.\n\n## Test this branch\n'
footer=$'\n\xf0\x9f\xa4\x96 Generated with [Claude Code](https://claude.com/claude-code)\n'
printf '%s' "$good" > "$repo/good.md"
printf '%s%s' "$good" "$footer" > "$repo/footer.md"
printf '%s' "$bad_no_test" > "$repo/bad.md"

# payload <tool_name> <cwd> <tool_input as JSON>
payload() { node -e 'process.stdout.write(JSON.stringify({hook_event_name:"PreToolUse",tool_name:process.argv[1],cwd:process.argv[2],tool_input:JSON.parse(process.argv[3])}))' "$1" "$2" "$3"; }
bash_cmd() { node -e 'process.stdout.write(JSON.stringify({command:process.argv[1]}))' "$1"; }
mcp_body() { node -e 'process.stdout.write(JSON.stringify({owner:"acme",repo:"app",title:"t",head:"b",base:"main",body:process.argv[1]}))' "$1"; }

fails=0
check() { # check <expected pass|deny> <name> <payload> [host]
  local want="$1" name="$2" json="$3" host="${4-github.example.net}" got code
  PR_DESCRIPTION_GH_HOST="$host" bash "$gate" <<<"$json" >/dev/null 2>"$tmp/err"; code=$?
  case "$code" in 0) got=pass ;; 2) got=deny ;; *) got="exit $code: $(cat "$tmp/err")" ;; esac
  if [ "$got" = "$want" ]; then echo "ok   $name"; else echo "FAIL $name: want $want, got $got"; fails=$((fails + 1)); fi
}

check pass "unrelated Bash command"            "$(payload Bash "$repo" "$(bash_cmd 'git status')")"
check pass "body file with both markers"       "$(payload Bash "$repo" "$(bash_cmd 'gh pr create --base main --title t --body-file good.md')")"
check pass "body file with the Claude Code footer" "$(payload Bash "$repo" "$(bash_cmd 'gh pr create --base main --title t --body-file footer.md')")"
check pass "inline --body with the footer"     "$(payload Bash "$repo" "$(bash_cmd "gh pr create --title t --body \"$good$footer\"")")"
check pass "MCP create with the footer"        "$(payload mcp__github__create_pull_request "$repo" "$(mcp_body "$good$footer")")"
check deny "body file without Test this branch" "$(payload Bash "$repo" "$(bash_cmd 'gh pr create --base main --title t --body-file bad.md')")"
check deny "gh pr edit with -F, bad file"      "$(payload Bash "$repo" "$(bash_cmd 'GH_HOST=github.example.net gh pr edit 12 -F bad.md')")"
check pass "absolute body file path"           "$(payload Bash "$tmp" "$(bash_cmd "gh pr edit 12 --body-file=$repo/good.md")")"
check pass "inline --body with both markers"   "$(payload Bash "$repo" "$(bash_cmd "gh pr create --title t --body \"$good\"")")"
check deny "inline --body without stat line"   "$(payload Bash "$repo" "$(bash_cmd "gh pr create --title t --body \"$bad_no_stat\"")")"
check pass "heredoc writes the file in the same command" "$(payload Bash "$repo" "$(bash_cmd "cat > new.md <<'X'"$'\n'"$good"$'X\n'"gh pr create --title t --body-file new.md")")"
check deny "markers only mentioned mid-line"   "$(payload Bash "$repo" "$(bash_cmd 'gh pr create --title t --body "see > **Logic:** and ## Test this branch"')")"
check pass "create without a body (--fill)"    "$(payload Bash "$repo" "$(bash_cmd 'gh pr create --fill')")"
check pass "edit without a body"               "$(payload Bash "$repo" "$(bash_cmd 'gh pr edit 12 --add-label bug')")"
check pass "origin on another host"            "$(payload Bash "$other" "$(bash_cmd 'gh pr create --title t --body-file bad.md')")"
check pass "gate off (host not set)"           "$(payload Bash "$repo" "$(bash_cmd 'gh pr create --title t --body-file bad.md')")" ""
check pass "MCP create with both markers"      "$(payload mcp__github__create_pull_request "$repo" "$(mcp_body "$good")")"
check deny "MCP create without stat line"      "$(payload mcp__plugin_github_github__create_pull_request "$repo" "$(mcp_body "$bad_no_stat")")"
check deny "MCP update without Test this branch" "$(payload mcp__github__update_pull_request "$repo" "$(mcp_body "$bad_no_test")")"
check pass "MCP update without a body"         "$(payload mcp__github__update_pull_request "$repo" '{"owner":"acme","repo":"app","pullNumber":12,"title":"t"}')"

if [ "$fails" -eq 0 ]; then echo "selftest: all passed"; else echo "selftest: $fails failed"; exit 1; fi
