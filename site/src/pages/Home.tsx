import { Card } from '../components/Card';
import { Examples, SearchBox } from '../components/SearchBox';
import { useTitle } from '../components/ui';
import { t } from '../i18n';
import { useCatalog } from '../lib/catalog';
import { TYPE_PLURAL } from '../lib/format';
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
        <h1>{t.home.heading}</h1>
        <p>{t.home.intro(plugins.length, componentCount)}</p>
        <SearchBox value="" />
        <Examples />
      </section>
      <div className="toolbar">
        <div className="tabs" role="toolbar" aria-label={t.home.browseByType}>
          {byType.map(([t, n]) => (
            <a key={t} className={`tab t-${t}`} href={hashFor('/search', { type: t })}>
              <span className="dot" />
              {TYPE_PLURAL[t]} <span className="count">{n}</span>
            </a>
          ))}
        </div>
        <a className="toolbar__note" href="#/getting-started">
          {t.home.newHere}
        </a>
      </div>
      <p className="result-meta">{t.home.browseAll(plugins.length, catalog.marketplace.name)}</p>
      <div className="grid">
        {plugins.map((d) => (
          <Card key={d.id} doc={d} />
        ))}
      </div>
    </>
  );
}
