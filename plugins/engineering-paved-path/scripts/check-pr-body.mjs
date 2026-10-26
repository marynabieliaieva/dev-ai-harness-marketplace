#!/usr/bin/env node
// Body check behind check-pr-body.sh — see that file for when it runs.
//
// Bash: finds `gh pr create|edit`. With --body-file/-F it reads that file (relative to the
// hook's cwd; Git Bash paths such as /tmp go through cygpath on Windows). A file that doesn't
// exist yet is usually written earlier in the same command, so the command text is checked
// too. With --body/-b the body is in the command text. No body flag (--fill, labels) passes.
// MCP: checks tool_input.body; an update without a body passes.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// Inside the command text a body starts right after its opening quote and may carry
// escaped newlines ($'…' quoting), hence the quote and `\\n` alternatives.
const STAT_LINE = /(^|\n|\\n|["'])> \*\*Logic:\*\*/;
const TEST_SECTION = /(^|\n|\\n)## Test this branch[ \t]*(\r?\n|\\n|$)/;

const pass = () => process.exit(0);
const deny = (why) => {
  process.stderr.write(
    `pr-description gate: ${why}. Rebuild the body with the pr-description skill ` +
      '(stat line from change-stats.sh first, `## Test this branch` last) and retry; ' +
      'do not work around this hook.\n',
  );
  process.exit(2);
};

const input = JSON.parse(readFileSync(0, 'utf8'));
const host = process.env.PR_DESCRIPTION_GH_HOST;
const cwd = input.cwd || process.cwd();

function originMatches() {
  try {
    const url = execFileSync('git', ['-C', cwd, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return url.includes(host);
  } catch {
    return false;
  }
}

function missing(text) {
  const gaps = [];
  if (!STAT_LINE.test(text)) gaps.push('the `> **Logic:**` stat line');
  if (!TEST_SECTION.test(text)) gaps.push('a `## Test this branch` section');
  return gaps;
}

// Splits a shell command into words; quotes are removed, nothing is expanded.
function words(cmd) {
  const out = [];
  let cur = '';
  let quote = null;
  let started = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < cmd.length) cur += cmd[++i];
      else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      started = true;
    } else if (c === '\\' && i + 1 < cmd.length) {
      cur += cmd[++i];
      started = true;
    } else if (/\s/.test(c) || ';&|()'.includes(c)) {
      if (started || cur) out.push(cur);
      cur = '';
      started = false;
      if (!/\s/.test(c)) out.push(c);
    } else {
      cur += c;
      started = true;
    }
  }
  if (started || cur) out.push(cur);
  return out;
}

function readBodyFile(p) {
  if (p.startsWith('~/')) p = path.join(os.homedir(), p.slice(2));
  if (process.platform === 'win32' && p.startsWith('/')) {
    try {
      p = execFileSync('cygpath', ['-w', p], { encoding: 'utf8' }).trim();
    } catch {
      // no cygpath: keep the path as given
    }
  }
  const abs = path.resolve(cwd, p);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function bashBody(cmd) {
  if (!/\bgh\s+pr\s+(create|edit)\b/.test(cmd)) return null;
  const w = words(cmd);
  const at = w.findIndex((x, i) => x === 'gh' && w[i + 1] === 'pr' && /^(create|edit)$/.test(w[i + 2]));
  let file = null;
  let inline = false;
  for (let i = at + 3; i < w.length && !';&|()'.includes(w[i]); i++) {
    const x = w[i];
    if (x === '--body-file' || x === '-F') file = w[i + 1] ?? '';
    else if (x.startsWith('--body-file=')) file = x.slice('--body-file='.length);
    else if (x === '--body' || x === '-b' || x.startsWith('--body=')) inline = true;
  }
  if (file === null && !inline) return null;
  if (file === '-') return cmd; // body on stdin: only the command text can be checked
  const fromFile = file === null ? null : readBodyFile(file);
  // A body file written earlier in the same command doesn't exist yet: check the command.
  return fromFile === null ? cmd : `${fromFile}\n${cmd}`;
}

let body = null;
if (input.tool_name === 'Bash') {
  body = bashBody(String(input.tool_input?.command ?? ''));
} else if (/__(create|update)_pull_request$/.test(input.tool_name ?? '')) {
  const b = input.tool_input?.body;
  body = typeof b === 'string' ? b : null;
}

if (body === null || !originMatches()) pass();
const gaps = missing(body);
if (gaps.length) deny(`the PR body is missing ${gaps.join(' and ')}`);
pass();
