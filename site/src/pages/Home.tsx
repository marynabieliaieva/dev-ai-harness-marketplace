import { Card } from '../components/Card';
import { Examples, SearchBox } from '../components/SearchBox';
import { useTitle } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { TYPE_PLURAL, plural } from '../lib/format';
import { hashFor } from '../lib/router';
import type { Doc } from '../lib/search';
import type { ComponentType } from '../lib/types';

export function Home({ docs }: { docs: Doc[] }) {
  const { catalog, stats } = useCatalog();
  useTitle('');
  const plugins = docs.filter((d) => d.type === 'plugin');
  const componentCount = docs.length - plugins.length;
  const byType = Object.entries(stats?.byType ?? {}) as [ComponentType, number][];

  return (
    <>
      <section className="hero">
        <h1>Find the right skill, agent or plugin</h1>
        <p>
          Search {plural(plugins.length, 'plugin')} and {plural(componentCount, 'component')} for Claude Code. Describe what you need in plain
          words.
        </p>
        <SearchBox value="" />
        <Examples />
      </section>
      <div className="toolbar">
        <div className="tabs" role="toolbar" aria-label="Browse by type">
          {byType.map(([t, n]) => (
            <a key={t} className={`tab t-${t}`} href={hashFor('/search', { type: t })}>
              <span className="dot" />
              {TYPE_PLURAL[t]} <span className="count">{n}</span>
            </a>
          ))}
        </div>
        <a className="toolbar__note" href="#/getting-started">
          New here? Getting started →
        </a>
      </div>
      <p className="result-meta">Browse all {plural(plugins.length, 'plugin')} in {catalog.marketplace.name}</p>
      <div className="grid">
        {plugins.map((d) => (
          <Card key={d.id} doc={d} />
        ))}
      </div>
    </>
  );
}
