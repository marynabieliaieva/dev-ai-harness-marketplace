#!/usr/bin/env node
// Step 3: lists the commits that could have made the test flaky — commits in
// the window before the reported date that touch the suspect scope, plus
// tests newly added next to the flaky one (shared state, ordering). The
// reported date is when flakiness was noticed, so the window reaches back
// further than forward, and widens on its own when it finds nothing.
//
// Usage: node candidates.mjs [--id <run>] [--back <days>] [--max-diff <bytes>]
// Writes candidates.json.

import path from 'node:path';
import { advance, atLeast, fail, git, parseArgs, readJson, requireRun, writeJson } from './lib/run.mjs';

const args = parseArgs();
const { id, dir, state } = requireRun(args);
if (!atLeast(state, 'scoped') || atLeast(state, 'analyzed')) fail(`run is at "${state.stage}"; candidates runs after scope`);

const input = readJson(path.join(dir, 'input.json'));
const scope = readJson(path.join(dir, 'scope.json'));
const maxDiff = Number(args['max-diff'] ?? 12_000);
const DAY = 86_400_000;
const reported = Date.parse(`${input.date}T00:00:00Z`);
const until = new Date(reported + 2 * DAY).toISOString().slice(0, 10);

const windows = args.back ? [Number(args.back)] : [14, 28, 56];
let commits = [];
let since;
for (const back of windows) {
  since = new Date(reported - back * DAY).toISOString().slice(0, 10);
  commits = collect(since);
  if (commits.length) break;
}

function collect(from) {
  const byHash = new Map();
  const log = (extra) =>
    git(['log', '--no-merges', `--since=${from}`, `--until=${until}`, '--format=%x1e%H%x1f%cs%x1f%an%x1f%s', '--name-only', ...extra])
      .split('\x1e')
      .filter((s) => s.trim());
  const add = (chunk, reason) => {
    const [head, ...files] = chunk.trim().split(/\r?\n/).filter(Boolean);
    const [hash, date, author, subject] = head.split('\x1f');
    const entry = byHash.get(hash) ?? { hash, date, author, subject, reasons: [], files: [] };
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    for (const f of files) if (!entry.files.includes(f)) entry.files.push(f);
    byHash.set(hash, entry);
  };
  for (const chunk of log(['--', ...scope.paths])) add(chunk, 'touches-scope');
  for (const chunk of log(['--diff-filter=A', '--', `${scope.moduleTestDir}/`])) add(chunk, 'new-test-in-module');
  return [...byHash.values()];
}

const inScope = new Set(scope.paths);
for (const c of commits) {
  const scoped = c.files.filter((f) => inScope.has(f) || f.startsWith(`${scope.moduleTestDir}/`));
  c.flags = {
    testFile: c.files.includes(scope.testFile),
    frameFile: c.files.some((f) => scope.frameFiles.includes(f)),
    importFile: c.files.some((f) => scope.imports.includes(f)),
    manifest: c.files.some((f) => scope.manifests.includes(f)),
    testConfig: c.files.some((f) => scope.testConfig.includes(f)),
    ci: c.files.some((f) => scope.ci.includes(f)),
  };
  let diff = scoped.length ? git(['show', '--format=', '--unified=3', c.hash, '--', ...scoped]) : '';
  c.diffTruncated = diff.length > maxDiff;
  if (c.diffTruncated) diff = `${diff.slice(0, maxDiff)}\n… [truncated, ${diff.length} bytes total — git show ${c.hash}]`;
  c.diff = diff;
  c.otherFiles = c.files.length - scoped.length;
  c.files = scoped;
}
commits.sort((a, b) => a.date.localeCompare(b.date));

writeJson(path.join(dir, 'candidates.json'), { since, until, count: commits.length, commits });
advance(id, 'scoped', 'candidates');

process.stdout.write(
  `${JSON.stringify(
    {
      since,
      until,
      count: commits.length,
      warning: commits.length === 0 ? `no commit in ${since}..${until} touches the scope — the cause may be outside the repo (CI image, external service, data)` : undefined,
    },
    null,
    2,
  )}\n`,
);
