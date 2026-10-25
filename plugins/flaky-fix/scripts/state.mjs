#!/usr/bin/env node
// Records what happened outside the scripts (Jira key, PR url) and closes the
// run. The guard hook reads the stage to decide which MCP writes are allowed.
//
// Usage:
//   node state.mjs show                 [--id <run>]
//   node state.mjs set-jira <KEY-123>   [--id <run>]   analyzed -> ticket
//   node state.mjs set-pr <https://...> [--id <run>]   pushed   -> pr
//   node state.mjs verifying            [--id <run>]   pr       -> verifying, closes the run
//   node state.mjs finish [--abandon]   [--id <run>]   closes the run at any stage

import path from 'node:path';
import { activeId, advance, atLeast, clearActive, fail, loadState, parseArgs, readJson, requireRun, saveState } from './lib/run.mjs';

const args = parseArgs();
const [cmd, value] = args._;
const { id, dir, state } = requireRun(args);

switch (cmd) {
  case 'show': {
    const budget = readJson(path.join(dir, 'budget.json'));
    print({ ...state, active: activeId() === id, budget });
    break;
  }
  case 'set-jira': {
    if (!/^[A-Z][A-Z0-9_]{0,19}-\d{1,7}$/.test(value ?? '')) fail(`"${value}" is not a Jira key like PROJ-123`);
    if (!atLeast(state, 'analyzed')) fail(`run is at "${state.stage}"; the ticket comes after a validated analysis`);
    if (state.jira) fail(`the run already has ticket ${state.jira}`);
    print(advance(id, 'analyzed', 'ticket', { jira: value }));
    break;
  }
  case 'set-pr': {
    if (!/^https:\/\/\S+$/.test(value ?? '')) fail('PR url must be https://…');
    print(advance(id, 'pushed', 'pr', { pr: value }));
    break;
  }
  case 'verifying': {
    print(advance(id, 'pr', 'verifying'));
    if (activeId() === id) clearActive();
    break;
  }
  case 'finish': {
    if (args.abandon) saveState(id, { ...loadState(id), abandoned: new Date().toISOString() });
    if (activeId() === id) clearActive();
    print({ id, stage: state.stage, closed: true, abandoned: Boolean(args.abandon) });
    break;
  }
  default:
    fail('usage: state.mjs show|set-jira <KEY>|set-pr <url>|verifying|finish [--abandon] [--id <run>]');
}

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}
