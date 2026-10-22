import type MiniSearch from 'minisearch';
import { useMemo } from 'react';
import { Card } from '../components/Card';
import { Examples, SearchBox } from '../components/SearchBox';
import { useTitle } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { TYPES, TYPE_PLURAL, plural, repoUrl } from '../lib/format';
import { hashFor } from '../lib/router';
import { search, type Doc } from '../lib/search';
import type { DocType } from '../lib/types';

export function Search({ ms, docMap, params }: { ms: MiniSearch<Doc>; docMap: Map<string, Doc>; params: URLSearchParams }) {
  const { catalog } = useCatalog();
  const q = params.get('q') ?? '';
  const explicit = (params.get('type') as DocType | 'all' | null) ?? null;
  const hasQuery = q.trim() !== '';
  useTitle(hasQuery ? `“${q}”` : 'Search');

  const all = useMemo(() => search(ms, docMap, q, 'all', false), [ms, docMap, q]);
  const { hits, terms, intentType, effectiveType } = useMemo(
    () => search(ms, docMap, q, explicit ?? 'all', !explicit),
    [ms, docMap, q, explicit],
  );

  const counts = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<DocType, number>;
  for (const h of all.hits) counts[h.doc.type]++;
  const tabs: [DocType | 'all', string, number][] = [['all', 'All', all.hits.length], ...TYPES.map((t): [DocType, string, number] => [t, TYPE_PLURAL[t], counts[t]])];
  const setType = (t: DocType | 'all') => hashFor('/search', { q, type: t === 'all' ? null : t });

  const requestUrl = repoUrl(catalog, `/issues/new?labels=plugin-request&title=${encodeURIComponent(`Skill request: ${q}`.slice(0, 120))}`);

  return (
    <>
      <section className="hero hero--compact">
        <SearchBox value={q} autoFocus />
        {!hasQuery && <Examples />}
      </section>
      <div className="toolbar">
        <div className="tabs" role="toolbar" aria-label="Filter by type">
          {tabs
            .filter(([t, , n]) => t === 'all' || n > 0 || t === effectiveType)
            .map(([t, label, n]) => (
              <a key={t} className={`tab t-${t}`} href={setType(t)} aria-pressed={effectiveType === t} role="button">
                <span className="dot" />
                {label} <span className="count">{n}</span>
              </a>
            ))}
        </div>
        <span className="toolbar__note">{hasQuery ? 'Sorted by relevance' : 'Sorted by name'}</span>
      </div>
      <p className="result-meta" aria-live="polite">
        {hasQuery ? (
          <>
            {plural(hits.length, 'result')} for “{q}”
            {!explicit && intentType && (
              <>
                {' '}
                · showing {TYPE_PLURAL[intentType].toLowerCase()} because your search mentions “{intentType}”{' '}
                <a href={hashFor('/search', { q, type: 'all' })}>Show all types</a>
              </>
            )}
          </>
        ) : (
          `${hits.length} ${effectiveType === 'all' ? (hits.length === 1 ? 'item' : 'items') : TYPE_PLURAL[effectiveType].toLowerCase()}`
        )}
      </p>
      {hits.length ? (
        <div className="grid">
          {hits.map((h) => (
            <Card key={h.doc.id} doc={h.doc} terms={terms} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>Nothing matches “{q}” yet</h2>
          <p>Try fewer or different words, or browse everything. If it doesn't exist, ask for it.</p>
          <div className="row">
            <a className="btn" href="#/search">
              Clear search
            </a>
            <a className="btn btn--primary" target="_blank" rel="noopener noreferrer" href={requestUrl}>
              Request this skill
            </a>
          </div>
        </div>
      )}
    </>
  );
}
