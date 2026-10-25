#!/usr/bin/env node
// Step 1: validates the four inputs, brings the default branch up to date
// with origin (fetch + fast-forward only), finds the test file, computes the
// verification budget and opens the run.
//
// Usage:
//   node intake.mjs --test <name> --date YYYY-MM-DD --rate <0.05|5%|1/20>
//                   --stack-file <path> [--test-file <path>] [--runs-per-day <n>]
//                   [--confidence 0.95] [--jira-project PROJ]
// Prints the run id and the run directory as JSON.

import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  activeId,
  dirtyPaths,
  excludeRunDir,
  fail,
  git,
  gitLines,
  parseArgs,
  runDir,
  saveState,
  setActive,
  slugify,
  syncOrigin,
  toRelative,
  writeJson,
} from './lib/run.mjs';

const args = parseArgs();

for (const key of ['test', 'date', 'rate', 'stack-file']) {
  if (typeof args[key] !== 'string' || !args[key].trim()) fail(`--${key} is required`);
}

const date = args.date.trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
  fail(`--date "${date}" is not a YYYY-MM-DD date`);
}
if (Date.parse(`${date}T00:00:00Z`) > Date.now()) fail(`--date ${date} is in the future`);

const p = parseRate(args.rate);
if (!(p > 0 && p < 1)) fail(`--rate "${args.rate}" must be a failure rate between 0 and 1 (0.05, 5%, 1/20)`);

const confidence = args.confidence === undefined ? 0.95 : Number(args.confidence);
if (!(confidence > 0.5 && confidence < 1)) fail('--confidence must be between 0.5 and 1');

const stackFile = path.resolve(args['stack-file']);
if (!existsSync(stackFile)) fail(`--stack-file ${stackFile} does not exist`);
const stack = readFileSync(stackFile, 'utf8');
if (stack.trim().length < 20) fail('the stack trace file is empty or too short');

const jiraProject = args['jira-project'] === undefined ? null : String(args['jira-project']).trim();
if (jiraProject !== null && !/^[A-Z][A-Z0-9_]{0,19}$/.test(jiraProject)) fail(`--jira-project "${jiraProject}" is not a Jira project key like PROJ`);

const test = args.test.trim();
const id = `${slugify(test, 50) || 'test'}-${date}`;
const current = activeId();
if (current && current !== id) {
  fail(`run "${current}" is still active — finish it first (node state.mjs finish)`);
}

// Analyse the latest default branch: fetch, then fast-forward the local copy.
// Never switches branches or discards work — those are the user's call.
excludeRunDir();
const baseRef = syncOrigin();
const defaultBranch = baseRef.replace(/^origin\//, '');
const branchNow = git(['branch', '--show-current']).trim();
if (branchNow !== defaultBranch) {
  fail(`on "${branchNow || 'detached HEAD'}" — the investigation reads the latest ${defaultBranch}. Switch to ${defaultBranch} with a clean working tree and start again`);
}
const dirty = dirtyPaths();
if (dirty.length) fail(`working tree is not clean — commit or stash first:\n  ${dirty.join('\n  ')}`);
try {
  git(['merge', '--ff-only', baseRef]);
} catch {
  fail(`local ${defaultBranch} has commits that are not on ${baseRef} — push or reset them, then start again`);
}
const baseShaAtIntake = git(['rev-parse', 'HEAD']).trim();

const testFile = args['test-file'] ? checkTestFile(args['test-file']) : findTestFile(test);

// Runs needed with zero failures so that "still flaky at rate p" is rejected
// at the given confidence: (1-p)^N <= 1-confidence.
const runsNeeded = Math.ceil(Math.log(1 - confidence) / Math.log(1 - p));
const runsPerDay = args['runs-per-day'] === undefined ? null : Number(args['runs-per-day']);
if (runsPerDay !== null && !(runsPerDay > 0)) fail('--runs-per-day must be a positive number');

const dir = runDir(id);
writeJson(path.join(dir, 'input.json'), { test, testFile, date, rate: p, rateInput: args.rate, jiraProject, baseRef, baseShaAtIntake });
copyFileSync(stackFile, path.join(dir, 'stacktrace.txt'));
writeJson(path.join(dir, 'budget.json'), {
  rate: p,
  confidence,
  runsNeeded,
  runsPerDay,
  etaDays: runsPerDay ? Math.ceil(runsNeeded / runsPerDay) : null,
  rule: `close after ${runsNeeded} consecutive green runs of the test on main; any failure reopens`,
});
saveState(id, { id, stage: 'intake', created: new Date().toISOString(), jira: null, branch: null, pr: null });
setActive(id);

process.stdout.write(`${JSON.stringify({ id, dir, testFile, runsNeeded, baseRef, baseShaAtIntake }, null, 2)}\n`);

function parseRate(raw) {
  const s = String(raw).trim();
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  if (s.endsWith('%')) return Number(s.slice(0, -1)) / 100;
  return Number(s);
}

function checkTestFile(raw) {
  const rel = toRelative(raw);
  if (!rel) fail(`--test-file ${raw} is outside the project`);
  if (gitLines(['ls-files', '--', rel]).length === 0) fail(`--test-file ${rel} is not tracked by git`);
  return rel;
}

// Accepts pytest ids (path::Class::test), JUnit (Class#method / Class.method),
// Go (TestName) and Jest titles ("suite > case"). Searches tracked files only.
function findTestFile(name) {
  if (name.includes('::')) {
    const file = name.split('::')[0];
    if (gitLines(['ls-files', '--', file]).length) return file;
  }
  const tokens = name.split(/::|#|>|\s+›\s+|\.(?=[A-Za-z_])/).map((t) => t.trim()).filter(Boolean);
  const leaf = tokens.at(-1);
  if (!leaf) fail(`cannot read a test name out of "${name}" — pass --test-file`);
  let hits;
  try {
    hits = gitLines(['grep', '-l', '-F', '--', leaf]);
  } catch {
    hits = [];
  }
  const testLike = hits.filter((f) => /(^|\/)(tests?|spec|__tests__)\/|[._-](test|spec)s?\.|Tests?\.|_test\.go$/i.test(f));
  const pool = testLike.length ? testLike : hits;
  const owner = tokens.length > 1 ? tokens.at(-2) : null;
  const ranked = owner ? pool.filter((f) => path.basename(f).toLowerCase().includes(owner.toLowerCase())) : [];
  const best = ranked.length ? ranked : pool;
  if (best.length === 1) return best[0];
  if (best.length === 0) fail(`no tracked file mentions "${leaf}" — pass --test-file`);
  fail(`"${name}" matches several files — pass --test-file. Candidates:\n  ${best.slice(0, 10).join('\n  ')}`);
}
