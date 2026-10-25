#!/usr/bin/env node
// Step 6: fetches origin again and creates the fix branch from the latest
// default branch, named after the recorded Jira key. Local only — the branch
// reaches the remote through push.mjs, which asks first.
//
// Usage: node branch.mjs [--id <run>]
// When the scope's files changed on origin since intake, the output lists
// them: the analysis was made on older code and should be rechecked.

import path from 'node:path';
import { advance, atLeast, dirtyPaths, fail, git, parseArgs, readJson, requireRun, slugify, syncOrigin } from './lib/run.mjs';

const args = parseArgs();
const { id, dir, state } = requireRun(args);
if (!atLeast(state, 'ticket')) fail(`run is at "${state.stage}"; record the Jira key first (state.mjs set-jira <KEY>)`);
if (atLeast(state, 'branched')) fail(`branch ${state.branch} already exists for this run`);

const dirty = dirtyPaths();
if (dirty.length) fail(`working tree is not clean — commit or stash first:\n  ${dirty.join('\n  ')}`);

const input = readJson(path.join(dir, 'input.json'));
const scope = readJson(path.join(dir, 'scope.json'));
const base = syncOrigin();
const baseSha = git(['rev-parse', '--verify', `${base}^{commit}`]).trim();
const scopeChanged =
  baseSha === input.baseShaAtIntake
    ? []
    : git(['diff', '--name-only', `${input.baseShaAtIntake}..${baseSha}`, '--', ...scope.paths]).split(/\r?\n/).filter(Boolean);

const name = `fix/${state.jira}-flaky-${slugify(input.test, 40) || 'test'}`;
git(['switch', '-c', name, baseSha]);
advance(id, 'ticket', 'branched', { branch: name, base, baseSha, scopeChangedSinceIntake: scopeChanged });
process.stdout.write(
  `${JSON.stringify(
    {
      branch: name,
      base,
      baseSha,
      scopeChangedSinceIntake: scopeChanged,
      warning: scopeChanged.length ? 'files in the scope changed on origin since the analysis — recheck the analysis against them before fixing' : undefined,
    },
    null,
    2,
  )}\n`,
);
