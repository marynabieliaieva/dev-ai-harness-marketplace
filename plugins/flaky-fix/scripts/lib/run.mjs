// Shared helpers for the flaky-fix scripts and the guard hook: the run
// directory and its state machine, git calls, path normalization.
//
// A run lives in <project>/.flaky/<id>/ and moves through STAGES in order.
// <project>/.flaky/ACTIVE holds the id of the run in progress; the guard hook
// enforces its rules only while that file exists. Node ESM, no dependencies.

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const STAGES = [
  'intake', // input.json, budget.json
  'scoped', // frames.json, scope.json
  'candidates', // candidates.json
  'analyzed', // analysis.json validated
  'ticket', // Jira key recorded
  'branched', // fix branch created
  'committed', // fix committed, masking.json written
  'reviewed', // review.json validated, verdict accept
  'pushed', // branch pushed
  'pr', // PR url recorded
  'verifying', // Jira moved to verification; run finished
];

export function projectDir() {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

export function flakyRoot(project = projectDir()) {
  return path.join(project, '.flaky');
}

export function activeId(project = projectDir()) {
  const file = path.join(flakyRoot(project), 'ACTIVE');
  if (!existsSync(file)) return null;
  const id = readFileSync(file, 'utf8').trim();
  return /^[a-z0-9][a-z0-9-]{0,80}$/.test(id) ? id : null;
}

export function runDir(id, project = projectDir()) {
  return path.join(flakyRoot(project), id);
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function loadState(id, project = projectDir()) {
  const file = path.join(runDir(id, project), 'state.json');
  if (!existsSync(file)) throw new Error(`no run "${id}" (missing ${file})`);
  return readJson(file);
}

export function saveState(id, state, project = projectDir()) {
  writeJson(path.join(runDir(id, project), 'state.json'), state);
}

export function stageIndex(stage) {
  const i = STAGES.indexOf(stage);
  if (i < 0) throw new Error(`unknown stage "${stage}"`);
  return i;
}

export function atLeast(state, stage) {
  return stageIndex(state.stage) >= stageIndex(stage);
}

/** Moves the run to `next`, which must be exactly one step after `from`
 * (or the current stage again, so a step can be redone). */
export function advance(id, from, next, extra = {}) {
  const state = loadState(id);
  const cur = stageIndex(state.stage);
  if (cur < stageIndex(from)) fail(`run is at "${state.stage}", this step needs "${from}" first`);
  if (cur > stageIndex(next)) fail(`run is already at "${state.stage}", past "${next}"`);
  Object.assign(state, extra, { stage: next, updated: new Date().toISOString() });
  saveState(id, state);
  return state;
}

/** Resolves the run id: --id flag, else ACTIVE. */
export function requireRun(args) {
  const id = args.id ?? activeId();
  if (!id) fail('no active run — start one with intake.mjs');
  return { id, dir: runDir(id), state: loadState(id) };
}

export function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: projectDir(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
}

export function gitLines(args) {
  return git(args).split(/\r?\n/).filter(Boolean);
}

/** Fetches origin and returns its default branch as a remote ref
 * (`origin/main`). Fails when there is no origin. */
export function syncOrigin() {
  try {
    git(['remote', 'get-url', 'origin']);
  } catch {
    fail('the repository has no "origin" remote');
  }
  try {
    git(['fetch', '--prune', 'origin']);
  } catch (e) {
    fail(`git fetch origin failed — the run needs the latest history:\n${e.stderr ?? e.message}`);
  }
  const head = () => git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).trim();
  try {
    return head();
  } catch {
    try {
      git(['remote', 'set-head', 'origin', '--auto']);
      return head();
    } catch {
      fail('cannot tell origin\'s default branch (git remote set-head origin --auto failed)');
    }
  }
}

/** { owner, repo } of origin, from an https or ssh URL. */
export function originRepo() {
  const url = git(['remote', 'get-url', 'origin']).trim();
  const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!m) fail(`cannot read owner/repo from origin URL ${url}`);
  return { owner: m[1], repo: m[2] };
}

/** Changed paths outside .flaky/ (which is excluded but may show if the
 * exclude was added after files existed). */
export function dirtyPaths() {
  return git(['status', '--porcelain'])
    .split(/\r?\n/)
    .filter((l) => l && !l.slice(3).startsWith('.flaky/'));
}

/** Keeps .flaky/ out of git without touching the tracked .gitignore. */
export function excludeRunDir() {
  const exclude = path.join(git(['rev-parse', '--git-common-dir']).trim(), 'info', 'exclude');
  const file = path.isAbsolute(exclude) ? exclude : path.join(projectDir(), exclude);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!/^\/?\.flaky\/?$/m.test(current)) {
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, `${current && !current.endsWith('\n') ? '\n' : ''}/.flaky/\n`);
  }
}

export function setActive(id) {
  mkdirSync(flakyRoot(), { recursive: true });
  writeFileSync(path.join(flakyRoot(), 'ACTIVE'), `${id}\n`);
}

export function clearActive() {
  rmSync(path.join(flakyRoot(), 'ACTIVE'), { force: true });
}

/** Normalizes a Windows or POSIX path (either slash, Git-Bash `/c/...` form)
 * into a lowercase-drive, forward-slash, `.`/`..`-collapsed form. */
export function normalize(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let p = raw.replace(/\\/g, '/');
  const gitBash = p.match(/^\/([A-Za-z])(\/.*)?$/);
  if (gitBash) p = `${gitBash[1].toLowerCase()}:${gitBash[2] ?? '/'}`;
  p = p.replace(/^([A-Za-z]):/, (_, d) => `${d.toLowerCase()}:`);
  return path.posix.normalize(p);
}

/** Project-relative path, or null when outside the project or climbing out. */
export function toRelative(rawPath, project = projectDir()) {
  const root = normalize(project);
  let file = normalize(rawPath);
  if (!file || !root) return null;
  if (!/^([a-z]:)?\//.test(file)) file = path.posix.join(root, file);
  const prefix = root.endsWith('/') ? root : `${root}/`;
  if (!file.startsWith(prefix)) return null;
  const rel = file.slice(prefix.length);
  if (rel === '' || rel.split('/').includes('..')) return null;
  return rel;
}

/** `--key value` / `--flag` argv parser. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function fail(message) {
  process.stderr.write(`flaky-fix: ${message}\n`);
  process.exit(1);
}

export function slugify(text, max = 40) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}
