#!/usr/bin/env node
// Step 9: pushes the run's branch to origin — never a force push, never
// another branch — and records origin's owner/repo for the PR check.
// The guard hook asks the user before this script runs.
//
// Usage: node push.mjs [--id <run>]

import { advance, atLeast, fail, git, originRepo, parseArgs, requireRun } from './lib/run.mjs';

const args = parseArgs();
const { id, state } = requireRun(args);
if (!atLeast(state, 'reviewed')) fail(`run is at "${state.stage}"; push needs an accepted review (validate.mjs review)`);
if (atLeast(state, 'pushed')) fail(`branch ${state.branch} is already pushed`);
if (git(['branch', '--show-current']).trim() !== state.branch) fail(`not on the run's branch ${state.branch}`);
const head = git(['rev-parse', 'HEAD']).trim();
if (head !== state.lastCommit) fail('HEAD moved since the reviewed commit — commit through commit.mjs and review again');

// Always origin: the guard checks the PR against origin's owner/repo.
const repo = originRepo();
git(['push', '--set-upstream', 'origin', `refs/heads/${state.branch}:refs/heads/${state.branch}`], { stdio: ['ignore', 'pipe', 'inherit'] });
advance(id, 'reviewed', 'pushed', { remote: 'origin', repo });
process.stdout.write(`${JSON.stringify({ pushed: state.branch, remote: 'origin', repo: `${repo.owner}/${repo.repo}`, head }, null, 2)}\n`);
