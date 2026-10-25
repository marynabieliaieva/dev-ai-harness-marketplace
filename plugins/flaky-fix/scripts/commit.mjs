#!/usr/bin/env node
// Step 7: commits the fix on the run's branch in the agreed format and scans
// the whole branch diff for masking changes (masking.json). Can be run again
// after a revision; each run adds a commit and rescans base..HEAD.
//
// Usage: node commit.mjs [--id <run>]
// Needs rationale.md in the run directory (why the fix removes the mechanism).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { scanMasking } from './lib/masking.mjs';
import { advance, atLeast, fail, git, parseArgs, readJson, requireRun, writeJson } from './lib/run.mjs';

const args = parseArgs();
const { id, dir, state } = requireRun(args);
if (!atLeast(state, 'branched') || atLeast(state, 'reviewed')) fail(`run is at "${state.stage}"; commit runs between branch and review`);
if (git(['branch', '--show-current']).trim() !== state.branch) fail(`not on the run's branch ${state.branch}`);
const rationaleFile = path.join(dir, 'rationale.md');
if (!existsSync(rationaleFile) || readFileSync(rationaleFile, 'utf8').trim().length < 40) {
  fail('write rationale.md in the run directory first — why the fix removes the mechanism');
}

const scope = readJson(path.join(dir, 'scope.json'));
const input = readJson(path.join(dir, 'input.json'));
const analysis = readJson(path.join(dir, 'analysis.json'));

// Porcelain v1: "XY path" or "XY old -> new"; .flaky/ is excluded via info/exclude.
const changed = git(['status', '--porcelain', '--untracked-files=all'])
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => l.slice(3).split(' -> ').at(-1).replace(/^"|"$/g, ''))
  .filter((f) => !f.startsWith('.flaky/'));
if (changed.length === 0) fail('nothing to commit');

const inScope = (f) => scope.editable.includes(f) || scope.editableDirs.some((d) => f.startsWith(`${d}/`));
const outside = changed.filter((f) => !inScope(f));

git(['add', '--', ...changed]);
const message = [
  `fix(${state.jira}): stabilize flaky ${input.test}`,
  '',
  analysis.mechanism.length > 300 ? `${analysis.mechanism.slice(0, 297)}...` : analysis.mechanism,
  '',
  `Flaky-Fix-Run: ${id}`,
].join('\n');
git(['commit', '-m', message]);
const sha = git(['rev-parse', 'HEAD']).trim();

const masking = scanMasking(state.baseSha);
writeJson(path.join(dir, 'masking.json'), { ...masking, outsideScope: outside });
// fix-critic has no shell; it reads the branch diff from here.
writeFileSync(path.join(dir, 'fix.diff'), git(['diff', '--no-color', `${state.baseSha}..HEAD`]));
advance(id, 'branched', 'committed', { lastCommit: sha });
process.stdout.write(`${JSON.stringify({ commit: sha, files: changed, outsideScope: outside, maskingHits: masking.hits.length }, null, 2)}\n`);
