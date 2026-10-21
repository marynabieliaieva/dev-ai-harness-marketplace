// Client-side search over the catalog index. Pure functions, no DOM — so it can be
// unit-tested and later swapped for a semantic (embedding) ranker behind the same API.
//
//   const docs = buildDocs(catalog);
//   const { results, intentType, terms } = search(docs, 'skill to break a feature into tasks');

export const TYPES = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];

// Words that name a component type: "I need a skill for…" filters to skills instead of
// being matched as text.
const TYPE_WORDS = {
  plugin: 'plugin', plugins: 'plugin',
  skill: 'skill', skills: 'skill',
  agent: 'agent', agents: 'agent', subagent: 'agent', subagents: 'agent',
  command: 'command', commands: 'command', slash: 'command',
  hook: 'hook', hooks: 'hook',
  mcp: 'mcp',
};

const STOPWORDS = new Set(`a an the i me my we our you your need needs want wants looking look find
  for to of in on at by with from into about and or but that which who what how do does is are be
  can could would should will please some something thing things help helps tool tools use using
  it its this these those there here just like make get`.split(/\s+/));

// Query expansion, both for jargon and for describing a need in other words. Keys and
// values are matched after stemming, so "tests", "testing" and "tested" all hit "test".
const SYNONYMS = {
  test: ['tdd', 'testing', 'e2e', 'unit'],
  tdd: ['test'],
  spec: ['specification', 'requirements', 'specify', 'prd'],
  requirement: ['spec', 'specify', 'user-stories'],
  pr: ['pull-request', 'review'],
  review: ['critic', 'audit', 'reviewer', 'critique', 'code-review'],
  architecture: ['design', 'adr', 'c4', 'arc42'],
  arch: ['architecture', 'design'],
  design: ['architecture'],
  db: ['database', 'schema', 'migrations'],
  database: ['schema', 'migrations', 'sql', 'data-model'],
  decision: ['adr'],
  research: ['investigate', 'sources', 'researcher'],
  competitor: ['competitive', 'market'],
  security: ['guard', 'destructive', 'secrets'],
  safe: ['guard', 'destructive'],
  dangerous: ['destructive', 'guard', 'block'],
  risky: ['destructive', 'guard'],
  prevent: ['block', 'guard'],
  docs: ['documentation', 'readme', 'changelog'],
  release: ['changelog', 'ship', 'release-notes'],
  deploy: ['ship', 'release'],
  task: ['breakdown', 'planning', 'backlog'],
  plan: ['tasks', 'breakdown', 'planning'],
  split: ['breakdown', 'tasks'],
  break: ['breakdown'],
  idea: ['interview', 'brief'],
  brainstorm: ['interview', 'idea'],
  api: ['openapi', 'contract', 'endpoints'],
  commit: ['git', 'conventional-commits'],
  git: ['github', 'commit'],
  lint: ['linter', 'code-style'],
  style: ['conventions', 'code-style'],
  frontend: ['react', 'components'],
  ts: ['typescript'],
};

const FIELD_WEIGHTS = { name: 6, keywords: 4, description: 2.5, plugin: 1.2, body: 1 };

export function stem(word) {
  if (word.length <= 4) return word;
  return word.replace(/(ing|ed|es|s)$/, '') || word;
}

/** Lowercase words; hyphenated names also yield their parts ("data-model" → data-model, data, model). */
export function words(text) {
  const out = [];
  for (const w of String(text ?? '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []) {
    const clean = w.replace(/-+$/, '');
    out.push(clean);
    if (clean.includes('-')) out.push(...clean.split('-').filter(Boolean));
  }
  return out;
}

const tokenSet = (...texts) => new Set(texts.flatMap(words).map(stem));

const SYNONYM_STEMS = Object.fromEntries(
  Object.entries(SYNONYMS).map(([k, v]) => [stem(k), v.map((w) => stem(w.toLowerCase()))]),
);

/** One searchable document per plugin and per component. */
export function buildDocs(catalog) {
  const docs = [];
  for (const p of catalog.plugins) {
    docs.push({
      id: `plugin:${p.name}`,
      type: 'plugin',
      name: p.name,
      title: p.displayName || p.name,
      plugin: p.name,
      description: p.description,
      keywords: p.keywords ?? [],
      fields: {
        name: tokenSet(p.name, p.displayName),
        keywords: tokenSet(...(p.keywords ?? [])),
        description: tokenSet(p.description),
        plugin: new Set(),
        body: tokenSet(...(p.overview ?? []), ...p.components.map((c) => c.name)),
      },
    });
    for (const c of p.components) {
      docs.push({
        id: `${c.type}:${p.name}:${c.name}`,
        type: c.type,
        name: c.name,
        title: c.name,
        plugin: p.name,
        description: c.description,
        keywords: c.keywords ?? [],
        fields: {
          name: tokenSet(c.name),
          keywords: tokenSet(...(c.keywords ?? []), c.event, c.matcher),
          description: tokenSet(c.description),
          plugin: tokenSet(p.name, ...(p.keywords ?? [])),
          body: tokenSet(...(c.tools ?? []), ...(c.hosts ?? [])),
        },
      });
    }
  }
  return docs;
}

function editDistanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** 1 exact, 0.75 prefix, 0.45 one typo; returns the best and the doc word that matched. */
function matchField(set, term) {
  let best = 0;
  for (const w of set) {
    let s = 0;
    if (w === term) s = 1;
    else if (term.length >= 2 && w.startsWith(term)) s = 0.75;
    else if (term.length >= 5 && editDistanceAtMostOne(w, term)) s = 0.45;
    if (s > best) best = s;
    if (best === 1) break;
  }
  return best;
}

/** Splits a free-text query into search terms and an optional type taken from the words. */
export function parseQuery(query) {
  let intentType = null;
  const terms = [];
  for (const w of words(query)) {
    if (TYPE_WORDS[w]) { intentType ??= TYPE_WORDS[w]; continue; }
    if (STOPWORDS.has(w) || w.length < 2) continue;
    const s = stem(w);
    if (!terms.includes(s)) terms.push(s);
  }
  return { terms, intentType };
}

/**
 * @param {object[]} docs  from buildDocs
 * @param {string} query   free text
 * @param {{type?: string, useIntent?: boolean}} opts  explicit type filter ('all' or a TYPES
 *   value) wins over intent; useIntent=false ignores type words in the query
 */
export function search(docs, query, { type = 'all', useIntent = true } = {}) {
  const { terms, intentType } = parseQuery(query);
  const effectiveType = type !== 'all' ? type : (useIntent && intentType) || 'all';
  const pool = effectiveType === 'all' ? docs : docs.filter((d) => d.type === effectiveType);

  if (!terms.length) {
    return { results: pool.map((doc) => ({ doc, score: 0 })), terms, intentType, effectiveType };
  }

  const results = [];
  for (const doc of pool) {
    let score = 0;
    let matched = 0;
    for (const term of terms) {
      const variants = [[term, 1], ...(SYNONYM_STEMS[term] ?? []).map((v) => [v, 0.6])];
      let best = 0;
      for (const [v, factor] of variants) {
        for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
          const s = matchField(doc.fields[field], v) * weight * factor;
          if (s > best) best = s;
        }
      }
      if (best > 0) matched++;
      score += best;
    }
    if (!matched) continue;
    // Prefer documents that cover more of the query over ones that match one word strongly.
    score *= (matched / terms.length) ** 1.5;
    results.push({ doc, score });
  }
  results.sort((a, b) => b.score - a.score || a.doc.name.localeCompare(b.doc.name));
  return { results, terms, intentType, effectiveType };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Escaped HTML with every word that starts with a search term wrapped in <mark>. */
export function highlight(text, terms) {
  const usable = (terms ?? []).filter((t) => t.length >= 2);
  if (!usable.length) return esc(text);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${usable.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[\\p{L}\\p{N}]*`, 'giu');
  let out = '';
  let last = 0;
  for (const m of String(text ?? '').matchAll(re)) {
    out += esc(text.slice(last, m.index)) + `<mark>${esc(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + esc(String(text ?? '').slice(last));
}
