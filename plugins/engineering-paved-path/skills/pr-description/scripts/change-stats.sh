#!/usr/bin/env bash
# Prints the change-stat line for a PR description:
#   > **Logic:** +897 / −243 (23 files) · **Tests:** +943 / −2 (8 files) · **Docs:** +0 / −0 (0 files)
# Usage: change-stats.sh [base]   (default base: origin/main)
# Counts the branch's commits since the merge base (base...HEAD), like the PR diff does.
set -euo pipefail

base="${1:-origin/main}"

git rev-parse --git-dir >/dev/null 2>&1 || { echo "change-stats: not a git repository" >&2; exit 1; }
git rev-parse --verify --quiet "${base}^{commit}" >/dev/null || { echo "change-stats: unknown base '${base}' (fetch it first?)" >&2; exit 1; }

# Tests: *.test.*, *.spec.*, __tests__/, __e2e-tests__/, __mocks__/, test-runner configs.
# Docs: *.md, *.mdx, docs/. Everything else: Logic. Tests win over Docs.
classify() {
  local path="$1" name="${1##*/}"
  case "/$path" in
    */__tests__/*|*/__e2e-tests__/*|*/__mocks__/*) echo tests; return ;;
  esac
  case "$name" in
    *.test.*|*.spec.*) echo tests; return ;;
    jest.config.*|vitest.config.*|vitest.workspace.*|playwright.config.*|cypress.config.*|karma.conf.*) echo tests; return ;;
  esac
  case "/$path" in
    */docs/*) echo docs; return ;;
  esac
  case "$name" in
    *.md|*.mdx) echo docs; return ;;
  esac
  echo logic
}

declare -A add=([logic]=0 [tests]=0 [docs]=0) del=([logic]=0 [tests]=0 [docs]=0) files=([logic]=0 [tests]=0 [docs]=0)

# -z keeps paths unquoted; a rename is "a\td\t\0old\0new\0" and is counted under its new path.
# Binary files report "-" for both counts: they count as a file with no lines.
while IFS= read -r -d '' rec; do
  a="${rec%%$'\t'*}"; rest="${rec#*$'\t'}"
  d="${rest%%$'\t'*}"; path="${rest#*$'\t'}"
  if [ -z "$path" ]; then
    IFS= read -r -d '' _old; IFS= read -r -d '' path
  fi
  [ "$a" = "-" ] && a=0
  [ "$d" = "-" ] && d=0
  c="$(classify "$path")"
  add[$c]=$(( add[$c] + a )); del[$c]=$(( del[$c] + d )); files[$c]=$(( files[$c] + 1 ))
done < <(git -c core.quotepath=off diff --numstat -z -M "${base}...HEAD")

# Bytes, not literal characters, so the output doesn't depend on the script's or terminal's encoding.
minus=$'\xe2\x88\x92'   # U+2212 MINUS SIGN
dot=$'\xc2\xb7'         # U+00B7 MIDDLE DOT

part() { printf '**%s:** +%d / %s%d (%d files)' "$1" "${add[$2]}" "$minus" "${del[$2]}" "${files[$2]}"; }

printf '> %s %s %s %s %s\n' "$(part Logic logic)" "$dot" "$(part Tests tests)" "$dot" "$(part Docs docs)"
