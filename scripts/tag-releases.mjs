#!/usr/bin/env node
// Release every plugin whose plugin.json version has no `<plugin>--v<version>` tag yet.
// Node >= 22, no dependencies. Runs scripts/release.mjs for each one — the same preflight
// a maintainer runs by hand — dependencies first, so a dependent's range check sees the
// tag its dependency just got. Idempotent; .github/workflows/release-tags.yml runs it
// after every merge to main.
//
// Usage:
//   node scripts/tag-releases.mjs           # list what would be released + dry-run preflights
//   node scripts/tag-releases.mjs --push    # release (tag + push) each untagged plugin

import { parseArgs } from 'node:util';
import { fail, localPlugins, releasedVersions, runNodeScript, tagName } from './lib/common.mjs';

const { values: opts } = parseArgs({ options: { push: { type: 'boolean', default: false } } });

const plugins = localPlugins();
const byName = new Map(plugins.map((p) => [p.name, p]));
const pending = plugins.filter((p) => !releasedVersions(p.name).includes(p.manifest.version));

// Dependencies before dependents (the structural lint already rejects cycles).
const ordered = [];
const visit = (p) => {
  if (ordered.includes(p)) return;
  for (const dep of p.manifest.dependencies ?? []) {
    const target = byName.get(typeof dep === 'string' ? dep : dep?.name);
    if (target && pending.includes(target)) visit(target);
  }
  ordered.push(p);
};
pending.forEach(visit);

if (!ordered.length) {
  console.log('Every plugin version is already tagged — nothing to release.');
  process.exit(0);
}
console.log(`To release: ${ordered.map((p) => tagName(p.name, p.manifest.version)).join(', ')}`);

const pendingDeps = (p) => (p.manifest.dependencies ?? [])
  .map((dep) => byName.get(typeof dep === 'string' ? dep : dep?.name))
  .filter((d) => d && pending.includes(d));

for (const p of ordered) {
  console.log(`\n━━ ${p.name} ━━`);
  // A dry run tags nothing, so a dependent's range check would fail on a dependency
  // that is released in the same run; that check happens for real with --push.
  if (!opts.push && pendingDeps(p).length) {
    console.log(`  skipped in dry run: depends on ${pendingDeps(p).map((d) => d.name).join(', ')}, released first with --push`);
    continue;
  }
  if (runNodeScript('release.mjs', [p.name, ...(opts.push ? ['--push'] : [])]) !== 0) {
    fail(`release of ${p.name} failed — later plugins were not released`);
  }
}
