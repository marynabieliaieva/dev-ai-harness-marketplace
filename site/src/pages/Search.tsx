import type MiniSearch from 'minisearch';
import { useMemo } from 'react';
import { Card } from '../components/Card';
import { Examples, SearchBox } from '../components/SearchBox';
import { useTitle } from '../components/ui';
import { t } from '../i18n';
import { useCatalog } from '../lib/catalog';
import { TYPES, TYPE_PLURAL, repoUrl } from '../lib/format';
import { hashFor } from '../lib/router';
import { search, type Doc } from '../lib/search';
import type { DocType } from '../lib/types';

export function Search({ ms, docMap, params }: { ms: MiniSearch<Doc>; docMap: Map<string, Doc>; params: URLSearchParams }) {
  const { catalog } = useCatalog();
  const q = params.get('q') ?? '';
  const explicit = (params.get('type') as DocType | 'all' | null) ?? null;
  const hasQuery = q.trim() !== '';
  useTitle(hasQuery ? t.search.queryTitle(q) : t.search.title);

  const all = useMemo(() => search(ms, docMap, q, 'all', false), [ms, docMap, q]);
  const { hits, terms, intentType, effectiveType } = useMemo(
    () => search(ms, docMap, q, explicit ?? 'all', !explicit),
    [ms, docMap, q, explicit],
  );

  const counts = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<DocType, number>;
  for (const h of all.hits) counts[h.doc.type]++;
  const tabs: [DocType | 'all', string, number][] = [['all', t.search.all, all.hits.length], ...TYPES.map((t): [DocType, string, number] => [t, TYPE_PLURAL[t], counts[t]])];
  const setType = (t: DocType | 'all') => hashFor('/search', { q, type: t === 'all' ? null : t });

  const requestUrl = repoUrl(catalog, `/issues/new?labels=plugin-request&title=${encodeURIComponent(t.search.requestIssueTitle(q).slice(0, 120))}`);

  return (
    <>
      <section className="hero hero--compact">
        <SearchBox value={q} autoFocus />
        {!hasQuery && <Examples />}
      </section>
      <div className="toolbar">
        <div className="tabs" role="toolbar" aria-label={t.search.filterLabel}>
          {tabs
            .filter(([t, , n]) => t === 'all' || n > 0 || t === effectiveType)
            .map(([t, label, n]) => (
              <a key={t} className={`tab t-${t}`} href={setType(t)} aria-pressed={effectiveType === t} role="button">
                <span className="dot" />
                {label} <span className="count">{n}</span>
              </a>
            ))}
        </div>
        <span className="toolbar__note">{hasQuery ? t.search.byRelevance : t.search.byName}</span>
      </div>
      <p className="result-meta" aria-live="polite">
        {hasQuery ? (
          <>
            {t.search.resultsFor(hits.length, q)}
            {!explicit && intentType && (
              <>
                {t.search.intent(TYPE_PLURAL[intentType].toLowerCase(), intentType)}
                <a href={hashFor('/search', { q, type: 'all' })}>{t.search.showAllTypes}</a>
              </>
            )}
          </>
        ) : (
          effectiveType === 'all' ? t.count.items(hits.length) : `${hits.length} ${TYPE_PLURAL[effectiveType].toLowerCase()}`
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
          <h2>{t.search.noMatchTitle(q)}</h2>
          <p>{t.search.noMatchText}</p>
          <div className="row">
            <a className="btn" href="#/search">
              {t.search.clearSearch}
            </a>
            <a className="btn btn--primary" target="_blank" rel="noopener noreferrer" href={requestUrl}>
              {t.search.request}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
