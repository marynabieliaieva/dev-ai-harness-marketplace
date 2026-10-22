import { CodeLine, useTitle } from '../components/ui';
import { t } from '../i18n';
import { asset, useCatalog } from '../lib/catalog';
import { fmtDate, fmtMonth, installId } from '../lib/format';
import { hashFor } from '../lib/router';
import type { Release } from '../lib/types';

export function WhatsNew({ params }: { params: URLSearchParams }) {
  const { catalog, releases } = useCatalog();
  useTitle(t.whatsNew.title);
  const only = params.get('plugin') ?? '';
  const list = releases.filter((r) => !only || r.plugin === only);

  const months = new Map<string, Release[]>();
  for (const r of list) {
    const key = r.date ? fmtMonth(r.date) : t.whatsNew.undated;
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(r);
  }

  return (
    <div className="page releases">
      <nav className="crumbs" aria-label={t.common.breadcrumb}>
        <a href="#/">{t.common.explore}</a> / {t.whatsNew.title}
      </nav>
      <div className="releases__head">
        <div className="page-title">
          <h1>{t.whatsNew.title}</h1>
          <p>{t.whatsNew.intro}</p>
        </div>
        <div className="releases__filter">
          <label htmlFor="release-filter">{t.whatsNew.filter}</label>
          <select className="select" id="release-filter" value={only} onChange={(e) => (location.hash = hashFor('/whats-new', { plugin: e.target.value }))}>
            <option value="">{t.whatsNew.allPlugins}</option>
            {catalog.plugins.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
              </option>
            ))}
          </select>
          <a className="btn" href={asset('feed.xml')}>
            {t.whatsNew.subscribe}
          </a>
        </div>
      </div>
      {list.length === 0 && (
        <div className="empty">
          <h2>{t.whatsNew.noReleases}</h2>
        </div>
      )}
      {[...months].map(([month, items]) => (
        <section className="section" key={month}>
          <h2 className="month">{month}</h2>
          <ol className="timeline timeline--feed">
            {items.map((r) => (
              <li key={`${r.plugin}@${r.version}`} className={r.breaking ? 'is-major' : ''}>
                <span className="when">{fmtDate(r.date)}</span>
                <h3>
                  <a href={`#/plugin/${r.plugin}`}>{r.displayName}</a>
                  <code>v{r.version}</code>
                  {r.breaking && <span className="tag tag--breaking">{t.common.breaking}</span>}
                  {r.firstRelease && <span className="tag tag--new">{t.whatsNew.newPlugin}</span>}
                </h3>
                <ul>
                  {r.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                {r.latest && (
                  <CodeLine text={r.firstRelease ? `claude plugin install ${installId(catalog, r.plugin)}` : `claude plugin update ${installId(catalog, r.plugin)}`} />
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
