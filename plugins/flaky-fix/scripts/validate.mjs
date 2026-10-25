#!/usr/bin/env node
// Gate between the agents and the next step. An agent's JSON report is saved
// into the run directory; this script checks it against the schema and the
// run's own facts (commit hashes must be candidates, masking hits must be
// answered) and only then moves the run on. It also renders the exact Jira
// and PR text, so what reaches Jira/GitHub is assembled here, not retyped.
//
// Usage:
//   node validate.mjs analysis [--id <run>]   # analysis.json -> stage analyzed, jira-payload.json
//   node validate.mjs review   [--id <run>]   # review.json   -> stage reviewed, pr-body.md
// Exit 1 with a list of problems when the report doesn't pass.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { advance, atLeast, fail, gitLines, parseArgs, readJson, requireRun, writeJson } from './lib/run.mjs';

const CLASSES = [
  'async-wait',
  'race-condition',
  'order-dependency',
  'shared-state',
  'time-dependency',
  'randomness',
  'external-dependency',
  'resource-leak',
  'environment',
  'unknown',
];
const CONFIDENCE = ['high', 'medium', 'low'];

const args = parseArgs();
const kind = args._[0];
if (kind !== 'analysis' && kind !== 'review') fail('usage: validate.mjs analysis|review [--id <run>]');
const { id, dir, state } = requireRun(args);
const problems = [];
const need = (cond, msg) => {
  if (!cond) problems.push(msg);
};
const str = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;

const file = path.join(dir, `${kind}.json`);
if (!existsSync(file)) fail(`${file} not found — save the agent's JSON there first`);
let report;
try {
  report = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  fail(`${kind}.json is not valid JSON: ${e.message}`);
}

if (kind === 'analysis') validateAnalysis();
else validateReview();

function finish() {
  if (problems.length) fail(`${kind}.json rejected:\n  - ${problems.join('\n  - ')}`);
}

function validateAnalysis() {
  if (!atLeast(state, 'candidates') || atLeast(state, 'ticket')) fail(`run is at "${state.stage}"; analysis is validated after candidates, before the ticket`);
  const input = readJson(path.join(dir, 'input.json'));
  const budget = readJson(path.join(dir, 'budget.json'));
  const candidates = readJson(path.join(dir, 'candidates.json'));
  const known = new Map(candidates.commits.map((c) => [c.hash, c]));

  need(CLASSES.includes(report.classification), `classification must be one of: ${CLASSES.join(', ')}`);
  need(str(report.mechanism, 40), 'mechanism must explain the failure mechanism (40+ chars)');
  need(str(report.fixApproach, 20), 'fixApproach is required (20+ chars)');
  need(Array.isArray(report.evidence) && report.evidence.length > 0, 'evidence must list at least one item');
  const tracked = new Set(gitLines(['ls-files']));
  for (const [i, ev] of (report.evidence ?? []).entries()) {
    need(['stacktrace', 'file', 'commit'].includes(ev?.source), `evidence[${i}].source must be stacktrace|file|commit`);
    need(str(ev?.ref) && str(ev?.note), `evidence[${i}] needs ref and note`);
    if (ev?.source === 'file' && str(ev?.ref)) {
      const p = ev.ref.replace(/:\d+(-\d+)?$/, '');
      need(tracked.has(p), `evidence[${i}].ref "${ev.ref}" is not a tracked file`);
    }
    if (ev?.source === 'commit' && str(ev?.ref)) need(resolveHash(ev.ref, known), `evidence[${i}].ref "${ev.ref}" is not a candidate commit`);
  }
  need(Array.isArray(report.culprits), 'culprits must be an array (empty when none fits)');
  for (const [i, c] of (report.culprits ?? []).entries()) {
    const full = resolveHash(c?.hash, known);
    need(full, `culprits[${i}].hash "${c?.hash}" is not in candidates.json — only listed commits can be culprits`);
    if (full) c.hash = full;
    need(CONFIDENCE.includes(c?.confidence), `culprits[${i}].confidence must be high|medium|low`);
    need(str(c?.why, 20), `culprits[${i}].why is required (20+ chars)`);
  }
  if (Array.isArray(report.culprits) && report.culprits.length === 0) {
    need(str(report.noCulpritReason, 20), 'with no culprit, noCulpritReason must say why (20+ chars)');
  }
  need(str(report.jira?.summary, 10) && report.jira.summary.length <= 120, 'jira.summary is required, 10–120 chars');
  need(str(report.jira?.description, 40), 'jira.description is required (40+ chars)');
  if (report.reproIdea !== undefined && report.reproIdea !== null) need(str(report.reproIdea, 10), 'reproIdea must be text or null');
  finish();

  const top = report.culprits[0];
  const summary = report.jira.summary.trim();
  const description = [
    report.jira.description.trim(),
    '',
    '---',
    `*Test:* ${input.test} (${input.testFile})`,
    `*Noticed:* ${input.date} · *failure rate:* ${(budget.rate * 100).toFixed(2)}%`,
    `*Class:* ${report.classification}`,
    top ? `*Suspected commit:* ${top.hash.slice(0, 12)} (${top.confidence}) — ${known.get(top.hash).subject}` : `*Suspected commit:* none — ${report.noCulpritReason}`,
    `*Mechanism:* ${report.mechanism}`,
    `*Verification:* ${budget.rule}${budget.etaDays ? ` (≈${budget.etaDays} days)` : ''}`,
    '',
    `flaky-fix-run: ${id}`,
  ].join('\n');
  writeJson(file, report); // hashes expanded to full length
  writeJson(path.join(dir, 'jira-payload.json'), { summary, description });
  advance(id, 'candidates', 'analyzed');
  process.stdout.write(`${JSON.stringify({ ok: true, stage: 'analyzed', jiraPayload: path.join(dir, 'jira-payload.json') }, null, 2)}\n`);
}

function validateReview() {
  if (!atLeast(state, 'committed') || atLeast(state, 'pushed')) fail(`run is at "${state.stage}"; the review is validated after the commit, before the push`);
  const masking = readJson(path.join(dir, 'masking.json'));
  need(['accept', 'revise', 'reject'].includes(report.verdict), 'verdict must be accept|revise|reject');
  need(typeof report.addressesMechanism === 'boolean', 'addressesMechanism must be true or false');
  need(str(report.summary, 20), 'summary is required (20+ chars)');
  need(Array.isArray(report.findings), 'findings must be an array');
  need(Array.isArray(report.masking), 'masking must be an array answering every masking.json hit');
  for (const hit of masking.hits) {
    const answer = (report.masking ?? []).find((m) => m?.file === hit.file && m?.line === hit.line);
    need(answer && typeof answer.justified === 'boolean' && str(answer.note, 10), `masking hit ${hit.file}:${hit.line} (${hit.pattern}) is not answered with justified + note`);
  }
  if (report.verdict === 'accept') {
    need(report.addressesMechanism === true, 'verdict accept requires addressesMechanism: true');
    need(!(report.masking ?? []).some((m) => m?.justified === false), 'verdict accept with an unjustified masking hit');
    need(!(report.findings ?? []).some((f) => f?.severity === 'blocker'), 'verdict accept with a blocker finding');
  }
  finish();

  if (report.verdict !== 'accept') {
    fail(`fix-critic verdict is "${report.verdict}" — revise the fix, commit.mjs again (it rescans), then the critic again`);
  }
  const input = readJson(path.join(dir, 'input.json'));
  const analysis = readJson(path.join(dir, 'analysis.json'));
  const budget = readJson(path.join(dir, 'budget.json'));
  const rationale = existsSync(path.join(dir, 'rationale.md')) ? readFileSync(path.join(dir, 'rationale.md'), 'utf8').trim() : '';
  if (rationale.length < 40) fail('rationale.md is missing or too short — write why the fix removes the mechanism');
  const top = analysis.culprits[0];
  const body = [
    `Fixes ${state.jira}: flaky \`${input.test}\`.`,
    '',
    '## Cause',
    `- Class: \`${analysis.classification}\``,
    `- Suspected commit: ${top ? `${top.hash.slice(0, 12)} (${top.confidence} confidence)` : 'none'}`,
    `- Mechanism: ${analysis.mechanism}`,
    '',
    '## Why this fix removes it',
    rationale,
    '',
    '## Review',
    `- fix-critic: ${report.summary}`,
    `- Masking patterns: ${masking.hits.length ? masking.hits.map((h) => `${h.file}:${h.line} ${h.pattern}`).join('; ') : 'none found'}`,
    '',
    '## Verification',
    '- Not run before merge (no extra pipeline runs). This PR only gets its normal CI run.',
    `- After merge: ${budget.rule}${budget.etaDays ? ` (≈${budget.etaDays} days)` : ''}.`,
    '',
    `flaky-fix-run: ${id}`,
  ].join('\n');
  writeFileSync(path.join(dir, 'pr-body.md'), `${body}\n`);
  advance(id, 'committed', 'reviewed');
  process.stdout.write(`${JSON.stringify({ ok: true, stage: 'reviewed', prBody: path.join(dir, 'pr-body.md') }, null, 2)}\n`);
}

function resolveHash(ref, known) {
  if (typeof ref !== 'string' || !/^[0-9a-f]{7,40}$/i.test(ref)) return null;
  const hits = [...known.keys()].filter((h) => h.startsWith(ref.toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
}
