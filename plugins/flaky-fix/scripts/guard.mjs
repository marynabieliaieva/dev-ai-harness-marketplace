#!/usr/bin/env node
// PreToolUse guard for a flaky-fix run. Registered in hooks/hooks.json for
// Bash, PowerShell, Edit, Write, NotebookEdit and every MCP tool.
//
// Inactive unless <project>/.flaky/ACTIVE exists: outside a run it exits 0
// at once and the session's normal permissions apply. During a run:
//
//   * the plugin's own scripts run without a prompt, push.mjs asks first;
//   * test runners, CI triggers, network tools, package installs, raw git
//     writes and gh writes are denied — no extra pipeline runs, and every git
//     write goes through a script that checks the run's stage;
//   * code edits are denied until the fix branch exists, pass inside the
//     run's editable scope, ask outside it, and are denied after the review;
//     in .flaky/ only the agent reports and rationale.md may be written;
//   * MCP: read tools pass; the four writes the run needs (create issue,
//     create PR, transition, comment) ask, and only at the right stage with
//     the text the scripts rendered; a PR only into origin's owner/repo,
//     from the run's branch, into its base; every other MCP write is denied.
//
// Decisions: exit 0 without output = no opinion, JSON on stdout = allow/ask,
// exit 2 + stderr = deny. With a run active, anything unexpected denies
// (fail closed); `rm .flaky/ACTIVE` by hand ends a run whose state is broken.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const OWN_SCRIPTS = ['intake', 'scope', 'candidates', 'validate', 'branch', 'commit', 'push', 'state'];

const BASH_DENY = [
  ['test runner', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|e2e)\b|\bnpx\s+(jest|vitest|mocha|playwright|cypress)\b|(^|[\s;&|(])(jest|vitest|mocha|pytest|tox|nox|rspec|phpunit|ctest)(\s|$)|\bpython[\d.]*\s+-m\s+(pytest|unittest)\b|\b(mvn|mvnw)\b[^|;&]*\b(test|verify|install|package)\b|\bgradlew?\b[^|;&]*\b(test|check|build)\b|\bgo\s+test\b|\bdotnet\s+test\b|\bcargo\s+(test|nextest)\b|\bbazel\s+test\b|Invoke-Pester/i],
  ['CI trigger', /\bgh\s+(workflow\s+run|run\s+(rerun|watch))\b|\bglab\s+ci\s+(run|retry)\b|\baz\s+pipelines\s+run\b|\/(build|buildWithParameters)\b|\bcircleci\b/i],
  ['network tool', /(^|[\s;&|(])(curl|wget|nc|ncat|ssh|scp|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)(\s|$)/i],
  ['package install', /\b(npm|pnpm|yarn|bun)\s+(i|install|add|ci)\b|\bpip[\d.]*\s+install\b|\buv\s+(add|pip)\b|\bpoetry\s+add\b|\bgo\s+get\b|\bcargo\s+add\b|\bdotnet\s+add\b|\bgem\s+install\b/i],
  ['git write (use the flaky-fix scripts)', /\bgit\b[^|;&]*\s(commit|push|reset|clean|rebase|merge|cherry-pick|revert|tag|switch|checkout|restore|stash|update-ref|config|remote|am|apply|filter-branch|gc|prune)\b|\bgit\b[^|;&]*\sbranch\s+-[dDmMf]/i],
  ['recursive delete', /\brm\s+-[a-z]*r|\bRemove-Item\b[^|;&]*-Recurse|\brmdir\s+\/s/i],
];

const MCP_READ = /^(get|list|search|read|fetch|lookup|view|query|describe|find)|(^|_)(get|list|search|read|info)$|UserInfo$|Resources$/i;
const MCP_WRITES = [
  { op: 'create-issue', re: /create[_-]?(jira[_-]?)?issue|issue[_-]?create/i },
  { op: 'create-pr', re: /create[_-]?pull[_-]?request|pull[_-]?request[_-]?create|create[_-]?pr\b/i },
  { op: 'transition', re: /transition/i },
  { op: 'comment', re: /add[_-]?comment|comment[_-]?(add|create)|create[_-]?comment/i },
];

const STAGES = ['intake', 'scoped', 'candidates', 'analyzed', 'ticket', 'branched', 'committed', 'reviewed', 'pushed', 'pr', 'verifying'];
const at = (state, stage) => STAGES.indexOf(state.stage) >= STAGES.indexOf(stage);

let active = false;

function deny(reason) {
  process.stderr.write(`flaky-fix guard: ${reason}\n`);
  process.exit(2);
}
function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: `flaky-fix: ${reason}` } }),
  );
  process.exit(0);
}
const pass = () => process.exit(0);

function normalize(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let p = raw.replace(/\\/g, '/');
  const gitBash = p.match(/^\/([A-Za-z])(\/.*)?$/);
  if (gitBash) p = `${gitBash[1].toLowerCase()}:${gitBash[2] ?? '/'}`;
  p = p.replace(/^([A-Za-z]):/, (_, d) => `${d.toLowerCase()}:`);
  return path.posix.normalize(p);
}

function relative(raw, root) {
  let file = normalize(raw);
  if (!file) return null;
  if (!/^([a-z]:)?\//.test(file)) file = path.posix.join(root, file);
  const prefix = root.endsWith('/') ? root : `${root}/`;
  if (!file.startsWith(prefix)) return null;
  const rel = file.slice(prefix.length);
  return rel && !rel.split('/').includes('..') ? rel : null;
}

function parsePayload() {
  const raw = readFileSync(0, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/\\/g, '\\\\'));
  }
}

function main() {
  let payload;
  try {
    payload = parsePayload();
  } catch {
    payload = null;
  }
  const projectRaw = process.env.CLAUDE_PROJECT_DIR || payload?.cwd;
  if (!projectRaw) pass();
  const project = path.resolve(projectRaw);
  const activeFile = path.join(project, '.flaky', 'ACTIVE');
  if (!existsSync(activeFile)) pass();
  active = true;

  if (!payload || typeof payload !== 'object') deny('unreadable hook payload during an active run');
  const id = readFileSync(activeFile, 'utf8').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)) deny(`.flaky/ACTIVE holds a bad run id — delete .flaky/ACTIVE to end the run`);
  const runDir = path.join(project, '.flaky', id);
  const read = (name) => JSON.parse(readFileSync(path.join(runDir, name), 'utf8'));
  const state = read('state.json');
  const root = normalize(project);
  const tool = String(payload.tool_name ?? '');
  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};

  if (tool === 'Bash' || tool === 'PowerShell') return guardShell(String(input.command ?? ''), state);
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
    return guardEdit(input.file_path ?? input.notebook_path, { id, state, root, read });
  }
  if (tool.startsWith('mcp__')) return guardMcp(tool, input, { id, state, read });
  pass();
}

function guardShell(command, state) {
  const own = ownScript(command);
  if (own === 'push') {
    if (!at(state, 'reviewed')) deny(`push needs an accepted review (run is at "${state.stage}")`);
    decide('ask', `push branch ${state.branch} to the remote (no force) — this publishes the fix`);
  }
  if (own) decide('allow', `${own}.mjs is a flaky-fix step script`);
  const why = (label) => `${label} is blocked during a flaky-fix run (no extra pipeline or test runs; git writes go through the scripts, GitHub/Jira writes through MCP). Command: ${command.slice(0, 200)}`;
  for (const [label, re] of BASH_DENY) if (re.test(command)) deny(why(label));
  // gh: read-only subcommands only (PRs are opened through MCP, with a prompt).
  const gh = /(^|[\s;&|(])gh\s+(\S+)(?:\s+(\S+))?/i.exec(command);
  if (gh && !/^(pr|issue|run|repo|release)$/i.test(gh[2] ?? '') && !(gh[2] === 'auth' && gh[3] === 'status')) deny(why('gh command'));
  if (gh && /^(pr|issue|run|repo|release)$/i.test(gh[2]) && !/^(view|list|status|diff|checks)$/i.test(gh[3] ?? '')) deny(why('gh write'));
  pass();
}

/** Name of the plugin script when the command is exactly one call to it. */
function ownScript(command) {
  if (/[;&|`<>\n\r]|\$\(/.test(command)) return null;
  const pluginRoot = normalize(process.env.CLAUDE_PLUGIN_ROOT ?? '');
  const flat = command.replace(/\\/g, '/').replace(/(^|["'\s])\/([a-zA-Z])\//g, '$1$2:/');
  const m = flat.match(/^\s*node(?:\.exe)?\s+["']?([^"'\s]+\/scripts\/([a-z]+)\.mjs)["']?(\s|$)/i);
  if (!m || !OWN_SCRIPTS.includes(m[2])) return null;
  const scriptPath = normalize(m[1]).toLowerCase();
  const expected = pluginRoot ? `${pluginRoot.toLowerCase()}/scripts/` : null;
  if (expected ? !scriptPath.startsWith(expected) : !scriptPath.includes('/flaky-fix/scripts/')) return null;
  return m[2];
}

function guardEdit(rawPath, { id, state, root, read }) {
  const rel = relative(rawPath, root);
  if (!rel) deny(`edit outside the project: ${rawPath}`);
  if (rel.startsWith('.flaky/')) {
    const allowed = [`.flaky/${id}/analysis.json`, `.flaky/${id}/review.json`, `.flaky/${id}/rationale.md`];
    if (allowed.includes(rel)) pass();
    deny(`${rel} is written by the flaky-fix scripts, not by hand (only analysis.json, review.json, rationale.md)`);
  }
  if (!at(state, 'branched')) deny(`no code edits before the fix branch exists (run is at "${state.stage}")`);
  if (at(state, 'reviewed')) deny(`the fix was reviewed — a new edit needs a new commit and review; the run is at "${state.stage}"`);
  const scope = read('scope.json');
  const inScope = scope.editable.includes(rel) || scope.editableDirs.some((d) => rel.startsWith(`${d}/`));
  if (inScope) pass();
  decide('ask', `${rel} is outside the flaky test's scope (test file, stack-trace files, their imports, the test's directory)`);
}

function guardMcp(tool, input, { id, state, read }) {
  const action = tool.split('__').at(-1) ?? '';
  const write = MCP_WRITES.find((w) => w.re.test(action));
  if (!write) {
    if (MCP_READ.test(action)) pass();
    deny(`MCP tool ${tool} is not one of the reads or the four writes a flaky-fix run needs`);
  }
  const text = (v) => (typeof v === 'string' ? v : '');
  const fields = input.fields && typeof input.fields === 'object' ? input.fields : {};
  switch (write.op) {
    case 'create-issue': {
      if (!at(state, 'analyzed')) deny(`create the Jira issue only after a validated analysis (run is at "${state.stage}")`);
      if (state.jira) deny(`the run already has ticket ${state.jira}`);
      const { jiraProject } = read('input.json');
      const project = text(input.projectKey) || text(input.project_key) || text(fields.project?.key) || text(input.project);
      if (jiraProject && project && project !== jiraProject) deny(`issue must go to project ${jiraProject}, got ${project}`);
      const payload = read('jira-payload.json');
      const summary = text(input.summary) || text(fields.summary) || text(input.title);
      if (summary.trim() !== payload.summary) deny('issue summary differs from .flaky/<run>/jira-payload.json — pass it unchanged');
      const description = text(input.description) || text(fields.description) || text(input.body);
      if (!description.includes(`flaky-fix-run: ${id}`)) deny('issue description must be jira-payload.json description, unchanged');
      decide('ask', `create Jira issue "${summary}"`);
      break;
    }
    case 'create-pr': {
      if (!at(state, 'pushed')) deny(`open the PR only after push.mjs (run is at "${state.stage}")`);
      if (state.pr) deny(`the run already has PR ${state.pr}`);
      // The PR goes to origin's repository, from the run's branch, into the
      // default branch the fix was cut from. All three must be stated.
      if (!state.repo?.owner || !state.repo?.repo) deny('push.mjs did not record origin\'s owner/repo — push through push.mjs first');
      let owner = text(input.owner);
      let repo = text(input.repo);
      const full = text(input.repository) || text(input.repo_full_name) || text(input.fullName) || (repo.includes('/') ? repo : '');
      if (full.includes('/')) [owner, repo] = full.split('/', 2);
      if (!owner || !repo) deny('PR target owner/repo is not stated — cannot check it against origin');
      const want = `${state.repo.owner}/${state.repo.repo}`;
      if (`${owner}/${repo}`.toLowerCase() !== want.toLowerCase()) deny(`PR must go to origin ${want}, got ${owner}/${repo}`);
      const head = text(input.head) || text(input.head_branch) || text(input.source_branch) || text(input.sourceBranch);
      const headOwner = head.includes(':') ? head.split(':')[0] : null;
      if (headOwner && headOwner.toLowerCase() !== state.repo.owner.toLowerCase()) deny(`PR head must be a branch of ${want}, got ${head}`);
      if (head.replace(/^[^:]+:/, '') !== state.branch) deny(`PR head must be ${state.branch}, got ${head || 'nothing'}`);
      const baseBranch = String(state.base ?? '').replace(/^origin\//, '');
      const prBase = text(input.base) || text(input.base_branch) || text(input.target_branch) || text(input.targetBranch);
      if (prBase !== baseBranch) deny(`PR base must be ${baseBranch} (the branch the fix was cut from), got ${prBase || 'nothing'}`);
      const body = text(input.body) || text(input.description);
      if (!body.includes(`flaky-fix-run: ${id}`)) deny('PR body must be .flaky/<run>/pr-body.md, unchanged');
      decide('ask', `open PR in ${want}: ${state.branch} → ${baseBranch} for ${state.jira}`);
      break;
    }
    case 'transition': {
      if (!at(state, 'pr')) deny(`move the issue only after the PR is recorded (run is at "${state.stage}")`);
      if (!JSON.stringify(input).includes(state.jira)) deny(`transition must target ${state.jira}`);
      decide('ask', `move ${state.jira} to the verification status`);
      break;
    }
    case 'comment': {
      if (!state.jira) deny('no ticket yet to comment on');
      if (!JSON.stringify(input).includes(state.jira)) deny(`comments may only go to ${state.jira}`);
      decide('ask', `comment on ${state.jira}`);
      break;
    }
  }
}

try {
  main();
} catch (err) {
  if (!active) process.exit(0);
  try {
    process.stderr.write(`flaky-fix guard: unexpected error during an active run, failing closed — ${err?.message ?? err}\n`);
  } catch {
    // stderr failed too; still block below.
  }
  process.exit(2);
}
