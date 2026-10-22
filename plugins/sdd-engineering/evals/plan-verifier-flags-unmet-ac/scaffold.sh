#!/usr/bin/env bash
# A one-task plan whose second acceptance criterion (404 for an unknown id) is not implemented.
set -euo pipefail

mkdir -p src docs/plans
cat > src/reviews.mjs <<'EOF'
const reviews = new Map([['r1', { id: 'r1', findings: ['a', 'b'] }]]);

export function exportCsv(id) {
  const review = reviews.get(id);
  const rows = review.findings.map((f) => `${review.id},${f}`);
  return { status: 200, type: 'text/csv', body: ['review,finding', ...rows].join('\n') };
}
EOF
cat > docs/plans/export-csv.md <<'EOF'
# Implementation Plan: export reviews to CSV

## Context
- Spec: none — requirements confirmed with the user, listed below
- Execution mode: single-agent
- Check commands: none (no test runner in this project)

## Tasks

### Task T1: CSV export
- Agent: implementer
- Requirement-ID: REQ-1
- Depends-on: none
- Owned paths: [src/reviews.mjs]
- Acceptance criteria:
  - `exportCsv(id)` returns status 200, type `text/csv` and one row per finding after a `review,finding` header
  - `exportCsv(id)` for an unknown id returns status 404 instead of throwing
- Done-condition: `grep -n "404" src/reviews.mjs`
EOF
