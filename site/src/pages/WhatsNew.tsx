import { CodeLine, useTitle } from '../components/ui';
import { asset, useCatalog } from '../lib/catalog';
import { fmtDate, installId } from '../lib/format';
import { hashFor } from '../lib/router';
import type { Release } from '../lib/types';

export function WhatsNew({ params }: { params: URLSearchParams }) {
  const { catalog, releases } = useCatalog();
  useTitle("What's new");
  const only = params.get('plugin') ?? '';
  const list = releases.filter((r) => !only || r.plugin === only);

  const months = new Map<string, Release[]>();
  for (const r of list) {
    const key = r.date ? new Date(`${r.date}T00:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' }) : 'Undated';
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(r);
  }

  return (
    <div className="page releases">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/">Explore</a> / What's new
      </nav>
      <div className="releases__head">
        <div className="page-title">
          <h1>What's new</h1>
          <p>Every plugin release, newest first. Users get a release when they update the plugin.</p>
        </div>
        <div className="releases__filter">
          <label htmlFor="release-filter">Plugin</label>
          <select className="select" id="release-filter" value={only} onChange={(e) => (location.hash = hashFor('/whats-new', { plugin: e.target.value }))}>
            <option value="">All plugins</option>
            {catalog.plugins.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
              </option>
            ))}
          </select>
          <a className="btn" href={asset('feed.xml')}>
            Subscribe (Atom)
          </a>
        </div>
      </div>
      {list.length === 0 && (
        <div className="empty">
          <h2>No releases yet</h2>
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
                  {r.breaking && <span className="tag tag--breaking">Breaking</span>}
                  {r.firstRelease && <span className="tag tag--new">New plugin</span>}
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
