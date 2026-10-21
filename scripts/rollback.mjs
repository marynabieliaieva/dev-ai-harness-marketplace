#!/usr/bin/env node
// Roll a plugin back to a released version without rewriting history. Node >= 22, no dependencies.
//
// Restores the plugin directory from the `<plugin>--v<good>` tag (files added since are
// removed), keeps the current CHANGELOG with a "Reverted" entry, and sets the version to
// the next PATCH — users only receive a new copy when the version string changes. The
// result is staged, not committed: open a PR like any release; CI tags it after merge.
//
// Usage:
//   node scripts/rollback.mjs <plugin> <good-version> [--reason "<text>"]
//   node scripts/rollback.mjs <plugin> <good-version> --dry-run

import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { addEntry, today } from './lib/changelog.mjs';
import {
  CATALOG_PATH, ROOT, fail, git, localPlugins, readJson, releasedVersions, runNodeScript, tagName, tryGit,
} from './lib/common.mjs';
import { compare, isValid, parse } from './lib/semver.mjs';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    reason: { type: 'string', default: '' },
    'dry-run': { type: 'boolean', default: false },
  },
});
const [pluginName, good] = positionals;
if (!pluginName || !good) fail('usage: node scripts/rollback.mjs <plugin> <good-version> [--reason "<text>"] [--dry-run]');

const plugin = localPlugins().find((p) => p.name === pluginName);
if (!plugin) fail(`plugin "${pluginName}" is not a local plugin in ${CATALOG_PATH}`);
const dir = relative(ROOT, plugin.dir).split('\\').join('/');

const goodTag = tagName(pluginName, good);
if (!isValid(good) || !tryGit('rev-parse', '--verify', '--quiet', `refs/tags/${goodTag}`)) {
  const released = releasedVersions(pluginName).filter(isValid).sort(compare);
  fail(`no tag ${goodTag} — released versions: ${released.join(', ') || 'none'}`);
}
const current = plugin.manifest.version;
if (compare(good, current) >= 0) fail(`${good} is not older than the current ${current}`);
if (git('status', '--porcelain', '--', dir) !== '') fail(`uncommitted changes under ${dir} — commit or stash them first`);

const v = parse(current);
const version = `${v.major}.${v.minor}.${v.patch + (v.pre.length ? 0 : 1)}`;
if (releasedVersions(pluginName).includes(version)) fail(`tag ${tagName(pluginName, version)} already exists — fix the version by hand`);

// Files that exist now but not in the good release are removed, not left behind.
const goodFiles = new Set(git('ls-tree', '-r', '--name-only', goodTag, '--', dir).split('\n').filter(Boolean));
const extra = git('ls-files', '--', dir).split('\n').filter((f) => f && !goodFiles.has(f));

console.log(`Rolling back ${pluginName}: ${current} → content of ${good}, released as ${version}${opts['dry-run'] ? '  (dry run)' : ''}`);
for (const f of extra) console.log(`  - remove ${f}`);
if (opts['dry-run']) process.exit(0);

const changelogPath = join(plugin.dir, 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');
if (extra.length) git('rm', '-q', '--', ...extra);
git('checkout', goodTag, '--', dir);

const reason = opts.reason ? ` Reason: ${opts.reason}` : '';
writeFileSync(changelogPath, addEntry(changelog, version, today(),
  `### Reverted\n\n- Restores the content of ${good}; rolls back ${current}.${reason}`));
// Replace only the value so the restored manifest keeps its formatting.
writeFileSync(plugin.manifestPath, readFileSync(plugin.manifestPath, 'utf8').replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`));
git('add', '--', dir);

if (runNodeScript('validate-marketplace.mjs') !== 0) fail('structural lint failed after the rollback — check the restored files');

const marketplace = readJson(CATALOG_PATH).name;
console.log(`
✔ Restored ${dir} from ${goodTag} as ${version} (staged). Review: git diff --staged
Next:
  git switch -c revert/${pluginName}-${version}
  git commit -m "revert(${pluginName}): roll back to ${good} as v${version}"   # then open a PR
After merge, CI tags ${tagName(pluginName, version)}. Tell consumers:
  claude plugin marketplace update ${marketplace}
  claude plugin update ${pluginName}@${marketplace}
If the release was unsafe, also follow docs/SECURITY.md#after-an-unsafe-release.`);
