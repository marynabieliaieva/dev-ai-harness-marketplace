#!/usr/bin/env node
// Release preflight + tag for one plugin. Node >= 22, no dependencies.
//
// Checks what `claude plugin tag` doesn't: the release commit is the tip of origin/main,
// the version moved forward and has a CHANGELOG entry, every dependency already has a
// released tag that satisfies its range, and both validators pass. Then it delegates
// tagging to `claude plugin tag` (which also checks plugin.json against the catalog entry).
//
// Usage:
//   node scripts/release.mjs <plugin>            # dry run: all checks + `claude plugin tag --dry-run`
//   node scripts/release.mjs <plugin> --push     # checks, create tag <plugin>--v<version>, push it
//   node scripts/release.mjs <plugin> --remote upstream --push
//
// Set CLAUDE_BIN when `claude` isn't on PATH (see scripts/lib/common.mjs).

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  CATALOG_PATH, CLAUDE_BIN, ROOT, fail, git, readJson, runClaude, runNodeScript, tagName, tryGit,
} from './lib/common.mjs';
import { compare, isValid, maxSatisfying } from './lib/semver.mjs';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    push: { type: 'boolean', default: false },
    remote: { type: 'string', default: 'origin' },
    branch: { type: 'string', default: 'main' },
  },
});
const pluginName = positionals[0];
if (!pluginName) fail('usage: node scripts/release.mjs <plugin> [--push] [--remote <name>]');

const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
const step = (title) => console.log(`\n▸ ${title}`);

// --- Plugin and version ------------------------------------------------------
const catalog = readJson(CATALOG_PATH);
const entry = catalog.plugins.find((p) => p.name === pluginName);
if (!entry) fail(`plugin "${pluginName}" is not in ${CATALOG_PATH}`);
if (typeof entry.source !== 'string') fail(`plugin "${pluginName}" has a remote source; release it in its own repository`);

const pluginDir = resolve(ROOT, entry.source);
const manifest = readJson(join(pluginDir, '.claude-plugin', 'plugin.json'));
const { version } = manifest;
if (!isValid(version)) fail(`plugin.json version "${version}" is not SemVer`);
const tag = tagName(pluginName, version);
console.log(`Releasing ${pluginName}@${version} → tag ${tag}${opts.push ? '' : '  (dry run)'}`);

// --- Git state ---------------------------------------------------------------
step(`git: clean tree, tip of ${opts.remote}/${opts.branch}`);
git('fetch', '--quiet', '--tags', opts.remote, opts.branch);
check(git('status', '--porcelain') === '', 'working tree has uncommitted changes');
check(git('rev-parse', 'HEAD') === git('rev-parse', `${opts.remote}/${opts.branch}`),
  `HEAD is not ${opts.remote}/${opts.branch} — release only merged, CI-green commits`);

const localTag = tryGit('rev-parse', '--verify', '--quiet', `refs/tags/${tag}`);
const remoteTag = git('ls-remote', '--tags', opts.remote, `refs/tags/${tag}`);
check(!localTag && !remoteTag, `tag ${tag} already exists — bump the version; tags are never moved`);

const released = git('tag', '--list', `${pluginName}--v*`).split('\n').filter(Boolean)
  .map((t) => t.slice(pluginName.length + 3)).filter(isValid);
const latest = released.sort(compare).at(-1);
if (latest) check(compare(version, latest) > 0, `version ${version} is not greater than released ${latest}`);
console.log(`  previous release: ${latest ?? 'none'}`);

// --- Changelog ---------------------------------------------------------------
step('CHANGELOG.md has an entry for this version');
const changelogPath = join(pluginDir, 'CHANGELOG.md');
const escaped = version.replace(/[.+]/g, '\\$&');
check(existsSync(changelogPath) &&
  new RegExp(`^#{1,3}\\s*\\[?v?${escaped}\\]?(\\s|$)`, 'm').test(readFileSync(changelogPath, 'utf8')),
  `CHANGELOG.md has no "## ${version}" (or "## [${version}]") heading`);

// --- Dependencies ------------------------------------------------------------
step('dependencies are released and satisfy their ranges');
for (const dep of manifest.dependencies ?? []) {
  const name = typeof dep === 'string' ? dep.split('@')[0] : dep.name;
  const range = typeof dep === 'string' ? '*' : dep.version ?? '*';
  if (typeof dep === 'string' ? dep.includes('@') : dep.marketplace) {
    console.log(`  ${name}: cross-marketplace, skipped`);
    continue;
  }
  const versions = git('tag', '--list', `${name}--v*`).split('\n').filter(Boolean)
    .map((t) => t.slice(name.length + 3)).filter(isValid);
  const match = maxSatisfying(versions, range);
  console.log(`  ${name}@${range}: ${match ? `ok (${tagName(name, match)})` : 'NO matching tag'}`);
  check(match, `dependency ${name}@${range} has no released tag — release it first`);
}

// --- Validators --------------------------------------------------------------
step('structural lint');
check(runNodeScript('validate-marketplace.mjs') === 0, 'scripts/validate-marketplace.mjs failed');
step(`claude plugin validate (${CLAUDE_BIN})`);
check(runClaude(['plugin', 'validate', '.']) === 0, 'claude plugin validate . failed');
check(runClaude(['plugin', 'validate', entry.source]) === 0, `claude plugin validate ${entry.source} failed`);

if (problems.length) {
  console.error(`\n✖ Not releasing ${pluginName}@${version}:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// --- Tag -----------------------------------------------------------------------
step(opts.push ? `claude plugin tag --push (${opts.remote})` : 'claude plugin tag --dry-run');
const tagArgs = ['plugin', 'tag', entry.source, '-m', `${pluginName} %s`];
if (opts.push) tagArgs.push('--push', '--remote', opts.remote);
else tagArgs.push('--dry-run');
if (runClaude(tagArgs) !== 0) fail('claude plugin tag failed');

console.log(opts.push
  ? `\n✔ Released ${tag}.`
  : `\n✔ Preflight passed. Re-run with --push to create and push ${tag}.`);
