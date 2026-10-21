#!/usr/bin/env node
// Structural linter for this marketplace. Node >= 22, no dependencies.
// Complements `claude plugin validate` with the repo's own rules from
// docs/PLUGIN-GUIDELINES.md and docs/SECURITY.md.
//
// Usage: node scripts/validate-marketplace.mjs [marketplace-root]
// Exit code: 0 = no errors (warnings allowed), 1 = errors found.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const CATALOG = join(ROOT, '.claude-plugin', 'marketplace.json');

const NAME_RE = /^[a-z0-9][a-z0-9.-]*$/; // kebab-case-ish; stricter than Claude Code's id rule
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const RESERVED_PREFIX_RE = /^(claude|anthropic|anthropics|cc-plugin)-/i;
const REQUIRED_PLUGIN_FILES = ['README.md', 'CHANGELOG.md'];
const TEXT_EXT = /\.(md|json|jsonc|ya?ml|toml|js|mjs|cjs|ts|mts|py|sh|bash|ps1|txt|env)$/i;

const SECRET_PATTERNS = [
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
];
const ABS_PATH_RE = /(?:\b[A-Za-z]:\\(?:Users|Documents and Settings)\\|(?<![\w$}])\/(?:Users|home)\/[A-Za-z0-9._-]+)/;

const errors = [];
const warnings = [];
// Both return undefined so `return err(...)` reads as "report and bail out".
const err = (where, msg) => void errors.push(`${where}: ${msg}`);
const warn = (where, msg) => void warnings.push(`${where}: ${msg}`);
const rel = (p) => relative(ROOT, p).split(sep).join('/') || '.';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(rel(path), `invalid JSON (${e.message})`);
    return undefined;
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function checkName(where, name, label) {
  if (typeof name !== 'string' || !name) return err(where, `${label} is required`);
  if (!NAME_RE.test(name)) err(where, `${label} "${name}" must be lowercase kebab-case`);
  if (RESERVED_PREFIX_RE.test(name)) err(where, `${label} "${name}" uses a reserved prefix`);
}

function scanFiles(pluginDir) {
  for (const file of walk(pluginDir)) {
    if (!TEXT_EXT.test(file) || statSync(file).size > 1_000_000) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const where = `${rel(file)}:${i + 1}`;
      for (const [label, re] of SECRET_PATTERNS) if (re.test(line)) err(where, `possible ${label}`);
      if (ABS_PATH_RE.test(line)) err(where, 'absolute user path — use ${CLAUDE_PLUGIN_ROOT}/${CLAUDE_SKILL_DIR}');
    });
  }
}

function checkPlugin(entry, index, catalogNames) {
  const where = `plugins[${index}] (${entry?.name ?? '?'})`;
  checkName(where, entry?.name, 'name');
  if ('version' in (entry ?? {})) err(where, 'set "version" in plugin.json only, not in the catalog entry');

  const source = entry?.source;
  if (typeof source !== 'string') {
    if (source && typeof source === 'object') warn(where, `remote source "${source.source}" — not checked locally`);
    else err(where, 'source is required');
    return undefined;
  }
  if (!source.startsWith('./')) return err(where, `source "${source}" must start with "./"`);
  if (source.includes('\\')) return err(where, `source "${source}" must use forward slashes`);
  if (source.split('/').includes('..')) return err(where, `source "${source}" must not contain ".."`);

  const dir = resolve(ROOT, source);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return err(where, `source directory ${source} does not exist`);

  const manifestDir = join(dir, '.claude-plugin');
  const manifestPath = join(manifestDir, 'plugin.json');
  if (!existsSync(manifestPath)) return err(where, `${rel(manifestPath)} is missing`);
  const extra = readdirSync(manifestDir).filter((f) => f !== 'plugin.json' && !/^icon\.(png|jpe?g)$/i.test(f));
  if (extra.length) err(rel(manifestDir), `only plugin.json belongs here, found: ${extra.join(', ')}`);

  const manifest = readJson(manifestPath);
  if (!manifest) return undefined;
  const mWhere = rel(manifestPath);
  checkName(mWhere, manifest.name, 'name');
  if (manifest.name !== entry.name) err(mWhere, `name "${manifest.name}" differs from catalog entry "${entry.name}"`);
  if (!SEMVER_RE.test(manifest.version ?? '')) err(mWhere, `version "${manifest.version ?? ''}" must be SemVer x.y.z`);
  if (!manifest.description) err(mWhere, 'description is required');
  if (!manifest.author?.name) err(mWhere, 'author.name is required');
  if (!manifest.license) warn(mWhere, 'license is missing');

  for (const file of REQUIRED_PLUGIN_FILES) if (!existsSync(join(dir, file))) err(rel(dir), `${file} is missing`);
  const changelog = join(dir, 'CHANGELOG.md');
  const esc = String(manifest.version).replace(/[.+]/g, '\\$&');
  // Same heading rule as scripts/release.mjs, so CI and the release preflight agree.
  if (existsSync(changelog) && !new RegExp(`^#{1,3}\\s*\\[?v?${esc}\\]?(\\s|$)`, 'm').test(readFileSync(changelog, 'utf8')))
    err(rel(changelog), `no "## [${manifest.version}]" entry for the version in plugin.json`);
  if (existsSync(join(dir, 'bin'))) err(rel(dir), 'top-level bin/ is not allowed — use scripts/');
  if (existsSync(join(dir, 'CLAUDE.md'))) err(rel(dir), 'CLAUDE.md in a plugin is not loaded — move it into a skill');
  if (!existsSync(join(dir, 'COMPATIBILITY.md'))) warn(rel(dir), 'COMPATIBILITY.md is missing');

  const deps = [];
  for (const dep of manifest.dependencies ?? []) {
    const raw = typeof dep === 'string' ? dep : dep?.name;
    const crossMarketplace = typeof dep === 'string' ? dep.includes('@') : Boolean(dep?.marketplace);
    if (!raw) { err(mWhere, 'dependency without a name'); continue; }
    if (crossMarketplace) { warn(mWhere, `cross-marketplace dependency "${raw}" — not checked locally`); continue; }
    if (!catalogNames.has(raw)) err(mWhere, `dependency "${raw}" is not in this marketplace`);
    if (raw === entry.name) err(mWhere, 'plugin depends on itself');
    deps.push(raw);
  }

  scanFiles(dir);
  return { name: entry.name, dir, deps };
}

function findCycle(graph) {
  const state = new Map(); // 1 = visiting, 2 = done
  const stack = [];
  const visit = (node) => {
    if (state.get(node) === 2) return null;
    if (state.get(node) === 1) return [...stack.slice(stack.indexOf(node)), node];
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, 2);
    return null;
  };
  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

function main() {
  if (!existsSync(CATALOG)) {
    err(rel(CATALOG), 'marketplace.json not found');
    return;
  }
  const catalog = readJson(CATALOG);
  if (!catalog) return;
  const where = rel(CATALOG);

  checkName(where, catalog.name, 'name');
  if (!catalog.owner?.name) err(where, 'owner.name is required');
  if (!catalog.description) warn(where, 'description is missing');
  if (!Array.isArray(catalog.plugins)) return err(where, 'plugins must be an array');
  if (catalog.plugins.length === 0) warn(where, 'no plugins registered yet');

  const names = catalog.plugins.map((p) => p?.name);
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) err(where, `duplicate plugin name "${n}"`);
    seen.add(n);
  }

  for (const [oldName, target] of Object.entries(catalog.renames ?? {})) {
    if (seen.has(oldName)) err(where, `renames key "${oldName}" is still an active plugin`);
    if (target !== null && !seen.has(target) && !(target in (catalog.renames ?? {})))
      err(where, `renames.${oldName} → "${target}" does not resolve`);
  }

  const graph = new Map();
  const registeredDirs = new Set();
  catalog.plugins.forEach((entry, i) => {
    const plugin = checkPlugin(entry, i, seen);
    if (!plugin) return;
    graph.set(plugin.name, plugin.deps);
    registeredDirs.add(resolve(plugin.dir));
  });

  const cycle = findCycle(graph);
  if (cycle) err(where, `dependency cycle: ${cycle.join(' → ')}`);

  const pluginsDir = join(ROOT, 'plugins');
  if (existsSync(pluginsDir)) {
    for (const d of readdirSync(pluginsDir, { withFileTypes: true })) {
      if (d.isDirectory() && !registeredDirs.has(resolve(pluginsDir, d.name)))
        err(`plugins/${d.name}`, 'directory is not registered in marketplace.json');
    }
  }
}

main();

for (const w of warnings) console.log(`⚠ ${w}`);
for (const e of errors) console.log(`✖ ${e}`);
console.log(
  errors.length
    ? `\n✖ ${errors.length} error(s), ${warnings.length} warning(s)`
    : `\n✔ Marketplace structure OK (${warnings.length} warning(s))`,
);
process.exit(errors.length ? 1 : 0);
