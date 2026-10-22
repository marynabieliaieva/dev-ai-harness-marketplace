// In-browser search over plugins and components with MiniSearch. Free-text queries: type
// words ("skill", "agents") filter by type instead of being matched, stopwords are dropped,
// and each term is expanded with synonyms at a lower weight.

import MiniSearch, { type SearchResult } from 'minisearch';
import type { Catalog, DocType } from './types';

export interface Doc {
  id: string;
  type: DocType;
  name: string;
  title: string;
  plugin: string;
  description: string;
  keywords: string;
  text: string;
  /** Route to open: the plugin page or the component's artifact page. */
  href: string;
}

const TYPE_WORDS: Record<string, DocType> = {
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

const SYNONYMS: Record<string, string[]> = {
  test: ['tdd', 'testing', 'tests'],
  tests: ['test', 'tdd'],
  tdd: ['test'],
  spec: ['specification', 'requirements', 'specs'],
  requirement: ['spec', 'requirements'],
  requirements: ['spec'],
  plan: ['planner', 'tasks', 'planning'],
  task: ['tasks', 'plan'],
  tasks: ['plan', 'task'],
  review: ['reviewer', 'verifier', 'audit'],
  verify: ['verifier', 'verification'],
  architecture: ['layers', 'onion', 'boundaries'],
  arch: ['architecture'],
  layer: ['onion', 'layers', 'architecture'],
  db: ['database', 'postgresql', 'drizzle', 'schema'],
  database: ['postgresql', 'drizzle', 'schema'],
  sql: ['postgresql', 'drizzle'],
  orm: ['drizzle'],
  research: ['researcher', 'investigate'],
  security: ['owasp', 'secrets', 'auth'],
  retro: ['retrospective'],
  retrospective: ['retro'],
  insight: ['insights', 'learning'],
  diagram: ['mermaid'],
  frontend: ['react', 'nextjs', 'next', 'components'],
  backend: ['fastify', 'server', 'onion'],
  validation: ['zod', 'schema'],
  ts: ['typescript'],
  implement: ['implementer', 'implementation'],
  code: ['implementer'],
};

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []).map((w) => w.replace(/-+$/, ''));
}

export function parseQuery(query: string): { terms: string[]; intentType: DocType | null } {
  let intentType: DocType | null = null;
  const terms: string[] = [];
  for (const w of words(query)) {
    if (TYPE_WORDS[w]) {
      intentType ??= TYPE_WORDS[w];
      continue;
    }
    if (STOPWORDS.has(w) || w.length < 2 || terms.includes(w)) continue;
    terms.push(w);
  }
  return { terms, intentType };
}

export function buildDocs(catalog: Catalog): Doc[] {
  return catalog.plugins.flatMap((p) => [
    {
      id: `plugin:${p.name}`,
      type: 'plugin' as const,
      name: p.name,
      title: p.displayName || p.name,
      plugin: p.name,
      description: p.description,
      keywords: p.keywords.join(' '),
      text: `${p.overview.join(' ')} ${p.readmeText} ${p.components.map((c) => c.name).join(' ')}`,
      href: `#/plugin/${p.name}`,
    },
    ...p.components.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      title: c.name,
      plugin: p.name,
      description: c.description,
      keywords: [...c.keywords, c.event ?? '', c.matcher ?? '', ...(c.tools ?? [])].join(' '),
      text: c.searchText,
      href: `#/artifact/${c.id}`,
    })),
  ]);
}

export function createIndex(docs: Doc[]) {
  const ms = new MiniSearch<Doc>({
    fields: ['name', 'title', 'keywords', 'description', 'plugin', 'text'],
    storeFields: ['id'],
    // Hyphenated names are both one token and their parts: "run-plan" → run-plan, run, plan.
    tokenize: (text) => {
      const out: string[] = [];
      for (const w of words(text)) {
        out.push(w);
        if (w.includes('-')) out.push(...w.split('-').filter(Boolean));
      }
      return out;
    },
    searchOptions: {
      boost: { name: 6, title: 5, keywords: 4, description: 2.5, plugin: 1.2, text: 1 },
      prefix: true,
      fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
    },
  });
  ms.addAll(docs);
  return ms;
}

export interface Hit {
  doc: Doc;
  score: number;
}

export interface SearchOutcome {
  hits: Hit[];
  terms: string[];
  intentType: DocType | null;
  effectiveType: DocType | 'all';
}

/**
 * @param type explicit type filter ('all' or a type) — wins over a type word in the query
 * @param useIntent false ignores type words in the query
 */
export function search(ms: MiniSearch<Doc>, docs: Map<string, Doc>, query: string, type: DocType | 'all' = 'all', useIntent = true): SearchOutcome {
  const { terms, intentType } = parseQuery(query);
  const effectiveType = type !== 'all' ? type : (useIntent && intentType) || 'all';
  const inType = (d: Doc) => effectiveType === 'all' || d.type === effectiveType;

  if (!terms.length) {
    return { hits: [...docs.values()].filter(inType).map((doc) => ({ doc, score: 0 })), terms, intentType, effectiveType };
  }

  // One OR-search per term (with its synonyms at 0.6), merged; a document's score is scaled by
  // how many of the user's terms it covers, so broad matches beat one strong word.
  const scores = new Map<string, { score: number; covered: number }>();
  for (const term of terms) {
    const perDoc = new Map<string, number>();
    const take = (results: SearchResult[], factor: number) => {
      for (const r of results) perDoc.set(r.id, Math.max(perDoc.get(r.id) ?? 0, r.score * factor));
    };
    take(ms.search(term), 1);
    const syn = SYNONYMS[term];
    if (syn) take(ms.search(syn.join(' '), { combineWith: 'OR' }), 0.6);
    for (const [id, s] of perDoc) {
      const cur = scores.get(id) ?? { score: 0, covered: 0 };
      scores.set(id, { score: cur.score + s, covered: cur.covered + 1 });
    }
  }

  const hits: Hit[] = [];
  for (const [id, { score, covered }] of scores) {
    const doc = docs.get(id);
    if (!doc || !inType(doc)) continue;
    hits.push({ doc, score: score * (covered / terms.length) ** 1.5 });
  }
  hits.sort((a, b) => b.score - a.score || a.doc.name.localeCompare(b.doc.name));
  return { hits, terms, intentType, effectiveType };
}
