// Shared helpers for the release scripts. Node >= 22, no dependencies.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CATALOG_PATH = join(ROOT, '.claude-plugin', 'marketplace.json');
export const STABLE_DIR = join(ROOT, 'channels', 'stable');
export const STABLE_CATALOG_PATH = join(STABLE_DIR, '.claude-plugin', 'marketplace.json');

export const tagName = (plugin, version) => `${plugin}--v${version}`;

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

/** Catalog entries with a local `./` source, each with its directory and plugin.json. */
export function localPlugins() {
  return readJson(CATALOG_PATH).plugins
    .filter((entry) => typeof entry.source === 'string')
    .map((entry) => {
      const dir = resolve(ROOT, entry.source);
      const manifestPath = join(dir, '.claude-plugin', 'plugin.json');
      return { name: entry.name, source: entry.source, dir, manifestPath, manifest: readJson(manifestPath) };
    });
}

/** Versions that have a `<plugin>--v<version>` tag in the local clone. */
export function releasedVersions(plugin) {
  return git('tag', '--list', `${plugin}--v*`).split('\n').filter(Boolean).map((t) => t.slice(plugin.length + 3));
}

/** Runs git in the repo root and returns trimmed stdout; throws on non-zero exit. */
export function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Like git(), but returns undefined instead of throwing. */
export function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return undefined;
  }
}

/**
 * The Claude Code CLI command. Override with CLAUDE_BIN when `claude` isn't on PATH,
 * e.g. CLAUDE_BIN="npx -y @anthropic-ai/claude-code@2.1.306".
 */
export const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

/** Runs the Claude Code CLI with inherited output; returns the exit code. */
export function runClaude(args, cwd = ROOT) {
  const quoted = args.map((a) => (/[\s"%]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  const result = spawnSync(`${CLAUDE_BIN} ${quoted.join(' ')}`, { cwd, stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

/** Runs a Node script from scripts/ with inherited output; returns the exit code. */
export function runNodeScript(name, args = []) {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', name), ...args], { cwd: ROOT, stdio: 'inherit' });
  return result.status ?? 1;
}

/** Parses `owner/repo` from the origin remote (https or ssh GitHub URL). */
export function originRepo(remote = 'origin') {
  const url = git('remote', 'get-url', remote);
  const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) throw new Error(`remote "${remote}" is not a GitHub repository: ${url.replace(/\/\/[^@/]+@/, '//')}`);
  return `${match[1]}/${match[2]}`;
}

export function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
