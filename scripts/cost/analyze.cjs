// Reads <out>/<case>/run*/stream.jsonl + work/ and prints per-run metrics, grader verdicts
// and per-case/overall aggregates as JSON. Usage: node scripts/cost/analyze.cjs <out-dir>
const fs = require('fs');
const path = require('path');
const out = process.argv[2];

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
};
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

// Graders mirror plugins/sdd-engineering/evals/<case>/graders, checked mechanically.
const GRADERS = {
  'spec-creator-requires-ac-per-requirement': (w, reply, agents) => {
    const spec = read(path.join(w, 'specs/2026-10-22-login-endpoint/spec.md'));
    const g = {
      dispatched: agents.includes('sdd-engineering:spec-creator'),
      'spec-written': !!spec,
      draft: !!spec && /Status:\s*draft/.test(spec),
      'acs-200-401': !!spec && /AC-\d[\s\S]*200/.test(spec) && /401/.test(spec),
      'ac-missing-recorded': !!spec && /AC missing/i.test(spec) && /rate/i.test(spec),
      'no-invented-limit': !!spec && !/\b\d+\s*(requests?|attempts?|req)\s*(per|\/)\s*(sec|second|min|minute|hour)/i.test(spec),
      'reported-incomplete': /INCOMPLETE/.test(reply) && /rate/i.test(reply),
    };
    return g;
  },
  'spec-creator-stays-in-specs': (w, reply, agents) => {
    const spec = read(path.join(w, 'specs/2026-10-21-health-endpoint/spec.md'));
    return {
      dispatched: agents.includes('sdd-engineering:spec-creator'),
      'spec-written': !!spec,
      'no-code-file': !fs.existsSync(path.join(w, 'src')),
      'ears-criteria': !!spec && /Status:\s*draft/.test(spec) && /AC-1/.test(spec) && /shall/.test(spec) && /50\s*ms/.test(spec) && /Verify:/.test(spec),
      'not-flagged-incomplete': !/INCOMPLETE/.test(reply),
    };
  },
};

const report = { cases: {}, overall: null };
const all = [];
for (const c of fs.readdirSync(out).filter((d) => GRADERS[d])) {
  const runs = [];
  for (const r of fs.readdirSync(path.join(out, c)).filter((d) => /^run\d+$/.test(d)).sort()) {
    const dir = path.join(out, c, r);
    const lines = (read(path.join(dir, 'stream.jsonl')) ?? '').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const init = lines.find((e) => e.type === 'system' && e.subtype === 'init');
    const res = lines.find((e) => e.type === 'result');
    let toolCalls = 0, apiCalls = 0;
    const agents = [];
    const seen = new Set();
    for (const e of lines) {
      if (e.type !== 'assistant') continue;
      const id = e.message?.id;
      if (id && !seen.has(id)) { seen.add(id); apiCalls++; }
      for (const b of e.message?.content ?? []) {
        if (b.type !== 'tool_use') continue;
        toolCalls++;
        if (b.name === 'Agent') agents.push(b.input?.subagent_type);
      }
    }
    // Usage across every model call: modelUsage when present, else the result's usage.
    const mu = res?.modelUsage ?? {};
    const tok = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    for (const m of Object.values(mu)) {
      tok.input += m.inputTokens ?? 0; tok.output += m.outputTokens ?? 0;
      tok.cacheRead += m.cacheReadInputTokens ?? 0; tok.cacheWrite += m.cacheCreationInputTokens ?? 0;
    }
    const reply = res?.result ?? '';
    const g = GRADERS[c](path.join(dir, 'work'), reply, agents);
    const pass = Object.values(g).every(Boolean);
    const run = {
      run: r, pluginErrors: init?.plugin_errors ?? null, models: Object.keys(mu),
      costUsd: res?.total_cost_usd ?? null, durationS: res ? res.duration_ms / 1000 : null,
      turns: res?.num_turns ?? null, apiCalls, toolCalls, tokens: tok, isError: res?.is_error ?? true,
      graders: g, pass,
    };
    runs.push(run); all.push(run);
  }
  const ok = runs.filter((x) => x.pass);
  report.cases[c] = {
    runs,
    passRate: `${ok.length}/${runs.length}`,
    medianCostUsd: median(runs.map((x) => x.costUsd)),
    medianDurationS: median(runs.map((x) => x.durationS)),
    costPerSuccessUsd: ok.length ? runs.reduce((s, x) => s + x.costUsd, 0) / ok.length : null,
  };
}
const ok = all.filter((x) => x.pass);
report.overall = {
  runs: all.length, passed: ok.length,
  totalCostUsd: all.reduce((s, x) => s + (x.costUsd ?? 0), 0),
  medianCostUsd: median(all.map((x) => x.costUsd)),
  medianDurationS: median(all.map((x) => x.durationS)),
  costPerSuccessUsd: ok.length ? all.reduce((s, x) => s + x.costUsd, 0) / ok.length : null,
  medianTokens: Object.fromEntries(['input', 'output', 'cacheRead', 'cacheWrite'].map((k) => [k, median(all.map((x) => x.tokens[k]))])),
  medianApiCalls: median(all.map((x) => x.apiCalls)),
  medianToolCalls: median(all.map((x) => x.toolCalls)),
};
console.log(JSON.stringify(report, null, 2));
