#!/usr/bin/env node
// PreToolUse guard for the sdd-engineering agents that may write exactly one
// kind of artifact. Registered for Edit|Write|NotebookEdit in hooks/hooks.json.
//
// Plugin hooks fire for every agent in the session, so the guard first looks
// at the hook input's `agent_type` (set inside a subagent and when the session
// runs with --agent). Anything that is not a guarded agent is allowed at once
// with exit 0 — including when the payload can't be read, because blocking
// every edit in the session would be worse than not guarding.
//
// For a guarded agent the contract is fail-closed: only exit 0 (allow) and
// exit 2 (block, stderr shown to the agent) are meaningful, and any other exit
// code lets the tool call proceed. Every path therefore ends in exit(0) or
// exit(2), and the outermost try/catch turns anything unexpected into exit 2.
//
// Keep POLICIES in sync with the agents' "Hard rules" — the same contract
// stated twice. Node ESM, no dependencies.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const POLICIES = {
  'spec-creator': ['specs/*/spec.md'],
  'implementation-planner': ['docs/plans/*.md'],
};

// Matches "sdd-engineering:spec-creator" as well as a bare "spec-creator"
// (an agent copied into a project's .claude/agents/).
function guardedAgent(agentType) {
  if (typeof agentType !== 'string') return null;
  for (const name of Object.keys(POLICIES)) {
    if (agentType === name || agentType.endsWith(`:${name}`)) return name;
  }
  return null;
}

// Minimal glob -> RegExp. Supports `*` (no slash), `**` and `**/` (any depth,
// including zero).
function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') {
      out += '(?:.*/)?';
      i += 2;
    } else if (c === '*' && glob[i + 1] === '*') {
      out += '.*';
      i += 1;
    } else if (c === '*') {
      out += '[^/]*';
    } else if ('.+^${}()|[]\\?'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

/** Normalizes a Windows or POSIX path (either slash, Git-Bash `/c/...` form)
 * into a lowercase-drive, forward-slash, `.`/`..`-collapsed form. */
function normalize(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let p = raw.replace(/\\/g, '/');
  const gitBash = p.match(/^\/([A-Za-z])(\/.*)?$/);
  if (gitBash) p = `${gitBash[1].toLowerCase()}:${gitBash[2] ?? '/'}`;
  p = p.replace(/^([A-Za-z]):/, (_, d) => `${d.toLowerCase()}:`);
  return path.posix.normalize(p);
}

/** Project-relative path, or null when outside the project or climbing out. */
function toRelative(filePath, projectDir) {
  if (filePath === projectDir) return null;
  const prefix = projectDir.endsWith('/') ? projectDir : `${projectDir}/`;
  if (!filePath.startsWith(prefix)) return null;
  const rel = filePath.slice(prefix.length);
  if (rel === '' || rel.split('/').includes('..')) return null;
  return rel;
}

function parsePayload() {
  let raw;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Some callers embed an unescaped Windows path; retry with every backslash
    // escaped. This only widens what reaches the allowlist check below.
    try {
      return JSON.parse(raw.replace(/\\/g, '\\\\'));
    } catch {
      return null;
    }
  }
}

let agent = null;

function reject(reason) {
  process.stderr.write(`sdd-engineering path-guard (${agent}): ${reason}\n`);
  process.exit(2);
}

function main() {
  const payload = parsePayload();
  agent = guardedAgent(payload && typeof payload === 'object' ? payload.agent_type : undefined);
  if (!agent) process.exit(0);

  const toolInput = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
  const rawFilePath =
    typeof toolInput.file_path === 'string'
      ? toolInput.file_path
      : typeof toolInput.notebook_path === 'string'
        ? toolInput.notebook_path
        : undefined;
  const file = normalize(rawFilePath);
  if (!file) return reject('no usable tool_input.file_path or tool_input.notebook_path in payload');

  const projectDir = normalize(
    process.env.CLAUDE_PROJECT_DIR || (typeof payload.cwd === 'string' ? payload.cwd : undefined),
  );
  if (!projectDir) return reject('could not determine the project dir (CLAUDE_PROJECT_DIR unset, no cwd)');

  const rel = toRelative(file, projectDir);
  if (rel === null) return reject(`rejected path outside the project or containing ".." — "${rawFilePath}"`);

  const allow = POLICIES[agent];
  if (allow.some((glob) => globToRegExp(glob).test(rel))) process.exit(0);
  reject(`rejected "${rel}" — ${agent} may only write to: ${allow.join(', ')}`);
}

try {
  main();
} catch (err) {
  if (!agent) process.exit(0);
  try {
    process.stderr.write(`sdd-engineering path-guard: unexpected error, failing closed — ${err?.stack ?? err}\n`);
  } catch {
    // stderr failed too; still block below.
  }
  process.exit(2);
}
