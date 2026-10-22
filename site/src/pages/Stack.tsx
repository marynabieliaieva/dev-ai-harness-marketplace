import { useEffect } from 'react';
import { useApp } from '../components/state';
import { CopyBlock, useTitle } from '../components/ui';
import { t } from '../i18n';
import { useCatalog } from '../lib/catalog';
import { installId } from '../lib/format';
import { hashFor } from '../lib/router';
import type { Plugin } from '../lib/types';

/** Plugins pulled in by the picked ones, with who requires each. */
function resolveDeps(plugins: Map<string, Plugin>, picked: Set<string>) {
  const requiredBy = new Map<string, Set<string>>();
  const visit = (name: string, by: string) => {
    for (const d of plugins.get(name)?.dependencies ?? []) {
      if (picked.has(d.name)) continue;
      if (!requiredBy.has(d.name)) requiredBy.set(d.name, new Set());
      const set = requiredBy.get(d.name)!;
      if (set.has(by)) continue;
      set.add(by);
      visit(d.name, by);
    }
  };
  for (const name of picked) visit(name, name);
  return requiredBy;
}

export function Stack({ params }: { params: URLSearchParams }) {
  const { catalog, plugins } = useCatalog();
  const { stack, toggleStack, setStack, copy } = useApp();
  useTitle(t.stack.title);

  // A shared link (#/stack?p=a,b) replaces the stack once, then the URL is cleaned up.
  const shared = params.get('p');
  useEffect(() => {
    if (shared === null) return;
    setStack(shared.split(','));
    history.replaceState(null, '', hashFor('/stack', { scope: params.get('scope') }));
  }, [shared, params, setStack]);

  const scope = params.get('scope') === 'user' ? 'user' : 'project';
  const picked = catalog.plugins.map((p) => p.name).filter((n) => stack.has(n));
  const deps = resolveDeps(plugins, new Set(picked));
  const repo = catalog.marketplace.repo ?? '<owner>/<repo>';
  const flag = scope === 'project' ? ' --scope project' : '';

  const settings = JSON.stringify(
    {
      extraKnownMarketplaces: { [catalog.marketplace.name]: { source: { source: 'github', repo } } },
      enabledPlugins: Object.fromEntries(picked.map((n) => [installId(catalog, n), true])),
    },
    null,
    2,
  );
  const steps: [string, string, string][] = [
    [scope === 'project' ? t.stack.runProject : t.stack.runShell, '', [`claude plugin marketplace add ${repo}${flag}`, ...picked.map((n) => `claude plugin install ${installId(catalog, n)}${flag}`)].join('\n')],
    [t.stack.inSession, '', [`/plugin marketplace add ${repo}`, ...picked.map((n) => `/plugin install ${installId(catalog, n)}`)].join('\n')],
    ...(scope === 'project'
      ? ([[t.stack.commit, t.stack.commitNote, settings]] as [string, string, string][])
      : []),
    [t.stack.reload, t.stack.reloadNote, ''],
  ];

  const item = (name: string, requiredBy?: string[]) => {
    const p = plugins.get(name)!;
    return (
      <div key={name} className={`stack-item${requiredBy ? ' is-dep' : ''}`}>
        <div className="grow">
          <strong>{p.displayName}</strong>
          <div className="note">{requiredBy ? t.stack.requiredBy(requiredBy.join(', ')) : t.stack.picked}</div>
        </div>
        {!requiredBy && (
          <button className="icon-btn" type="button" aria-label={t.stack.remove(p.displayName)} onClick={() => toggleStack(name)}>
            ✕
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <nav className="crumbs" aria-label={t.common.breadcrumb}>
        <a href="#/">{t.common.explore}</a> / {t.stack.title}
      </nav>
      <div className="layout">
        <div className="layout__main">
          <div className="page-title">
            <h1>{t.stack.title}</h1>
            <p>{t.stack.intro}</p>
          </div>

          <section className="section" aria-labelledby="h-pick">
            <h2 id="h-pick">{t.stack.pick}</h2>
            <div className="pick">
              {catalog.plugins.map((p) => (
                <label key={p.name}>
                  <input type="checkbox" checked={stack.has(p.name)} onChange={() => toggleStack(p.name)} />
                  <span>
                    <strong>{p.displayName}</strong>
                    <small>
                      {t.count.components(p.components.length)} · v{p.version}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="section" aria-labelledby="h-install">
            <h2 id="h-install">{t.stack.install}</h2>
            <div className="seg seg--wide" role="group" aria-label={t.stack.scopeLabel}>
              <a className="seg__btn" role="button" aria-pressed={scope === 'project'} href={hashFor('/stack')}>
                {t.stack.scopeProject}
              </a>
              <a className="seg__btn" role="button" aria-pressed={scope === 'user'} href={hashFor('/stack', { scope: 'user' })}>
                {t.stack.scopeUser}
              </a>
            </div>
            {picked.length ? (
              <ol className="steps">
                {steps.map(([title, note, code], i) => (
                  <li key={title}>
                    <span className="steps__n" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="steps__body">
                      <h3>{title}</h3>
                      {note && <p>{note}</p>}
                      {code && <CopyBlock text={code} />}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty empty--sm">
                <h3>{t.stack.emptyTitle}</h3>
                <p>
                  {t.stack.emptyBefore}
                  <a href="#/">{t.common.explore}</a>
                  {t.stack.emptyAfter}
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="layout__aside">
          <div className="panel">
            <h2>{t.stack.yourStack}</h2>
            {picked.map((n) => item(n))}
            {[...deps].map(([n, by]) => item(n, [...by]))}
            {picked.length ? (
              <div className="row">
                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    copy(`${location.origin}${location.pathname}${hashFor('/stack', { p: picked.join(','), scope: scope === 'user' ? 'user' : null })}`, t.stack.shareCopied)
                  }
                >
                  {t.stack.share}
                </button>
                <button className="btn" type="button" onClick={() => setStack([])}>
                  {t.common.clear}
                </button>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                {t.common.empty}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
