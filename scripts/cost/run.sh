#!/usr/bin/env bash
# Cost experiment runner: runs each eval case N times headless with all four plugins
# loaded from <repo>/plugins (--plugin-dir), installed copies disabled, fixed main model.
# Usage: [MODEL=...] scripts/cost/run.sh <repo> <out-dir> <runs> <case>...
set -u
REPO="$1"; OUT="$2"; N="$3"; shift 3
MODEL="${MODEL:-claude-opus-5-5}"
SETTINGS='{"enabledPlugins":{"sdd-engineering@dev-digest-ai-marketplace":false,"architecture-review@dev-digest-ai-marketplace":false,"research-tools@dev-digest-ai-marketplace":false,"engineering-paved-path@dev-digest-ai-marketplace":false,"sdd@sdd":false}}'
SUFFIX=$'\n\nRun the agent in the foreground and wait for its final message before you reply.'
for c in "$@"; do
  for i in $(seq 1 "$N"); do
    d="$OUT/$c/run$i"; rm -rf "$d"; mkdir -p "$d/work"
    ( cd "$d/work" && git init -q
      prompt=$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2' "$REPO/plugins/sdd-engineering/evals/$c/prompt.md")
      claude -p "$prompt$SUFFIX" --model "$MODEL" \
        --plugin-dir "$REPO/plugins/engineering-paved-path" --plugin-dir "$REPO/plugins/research-tools" \
        --plugin-dir "$REPO/plugins/architecture-review" --plugin-dir "$REPO/plugins/sdd-engineering" \
        --settings "$SETTINGS" --allowedTools "Read Glob Grep Agent Skill Write Edit" \
        --max-turns 30 --output-format stream-json --verbose > "$d/stream.jsonl" 2> "$d/stderr.log"
      echo "exit $?" >> "$d/stderr.log" )
  done
done
