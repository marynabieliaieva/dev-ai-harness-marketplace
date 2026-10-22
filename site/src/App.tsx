import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppProvider, useApp } from './components/state';
import { t } from './i18n';
import { CatalogContext, loadCatalog, useCatalog, type CatalogState } from './lib/catalog';
import { fmtDate, repoUrl } from './lib/format';
import { useRoute } from './lib/router';
import { buildDocs, createIndex } from './lib/search';
import { Artifact } from './pages/Artifact';
import { GettingStarted } from './pages/GettingStarted';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Plugin } from './pages/Plugin';
import { Search } from './pages/Search';
import { Stack } from './pages/Stack';
import { WhatsNew } from './pages/WhatsNew';

const NAV: [section: string, href: string, label: string][] = [
  ['explore', '#/', t.shell.nav.explore],
  ['getting-started', '#/getting-started', t.shell.nav.gettingStarted],
  ['stack', '#/stack', t.shell.nav.stack],
  ['whats-new', '#/whats-new', t.shell.nav.whatsNew],
];

export function App() {
  const [state, setState] = useState<CatalogState | null>(null);
  const [error, setError] = useState(false);
  const known = useMemo(() => new Set(state?.plugins.keys() ?? []), [state]);

  useEffect(() => {
    loadCatalog().then(setState, () => setError(true));
  }, []);

  if (error)
    return (
      <Shell>
        <div className="page">
          <div className="empty">
            <h2>{t.shell.unavailableTitle}</h2>
            <p>{t.shell.unavailableText}</p>
          </div>
        </div>
      </Shell>
    );
  if (!state)
    return (
      <Shell>
        <p className="loading">{t.shell.loadingCatalog}</p>
      </Shell>
    );

  return (
    <CatalogContext.Provider value={state}>
      <AppProvider knownPlugins={known}>
        <Routes />
      </AppProvider>
    </CatalogContext.Provider>
  );
}

function Routes() {
  const { path, params } = useRoute();
  const { catalog } = useCatalog();
  const docs = useMemo(() => buildDocs(catalog), [catalog]);
  const docMap = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const ms = useMemo(() => createIndex(docs), [docs]);
  const lastPath = useRef(path);

  useEffect(() => {
    if (path === '/releases') location.replace(`#/whats-new${params.size ? `?${params}` : ''}`);
  }, [path, params]);

  useEffect(() => {
    if (lastPath.current !== path && !params.get('c')) window.scrollTo(0, 0);
    lastPath.current = path;
  }, [path, params]);

  // "/" focuses the search box; on pages without one it opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
      if (e.key !== '/' || typing) return;
      e.preventDefault();
      const input = document.getElementById('q');
      if (input) input.focus();
      else location.hash = '#/search';
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  let page: ReactNode;
  let section = 'explore';
  if (path === '/') page = <Home docs={docs} />;
  else if (path === '/search') page = <Search ms={ms} docMap={docMap} params={params} />;
  else if (path.startsWith('/plugin/')) page = <Plugin name={decodeURIComponent(path.slice('/plugin/'.length))} params={params} />;
  else if (path.startsWith('/artifact/')) page = <Artifact id={decodeURIComponent(path.slice('/artifact/'.length))} />;
  else if (path === '/whats-new' || path === '/releases') [page, section] = [<WhatsNew params={params} />, 'whats-new'];
  else if (path === '/getting-started') [page, section] = [<GettingStarted />, 'getting-started'];
  else if (path === '/stack') [page, section] = [<Stack params={params} />, 'stack'];
  else [page, section] = [<NotFound />, ''];

  return (
    <Shell section={section} showFooter={path === '/'}>
      {page}
    </Shell>
  );
}

function StackCount() {
  const { stack } = useApp();
  return stack.size ? <span className="pill">{stack.size}</span> : null;
}

function Shell({ children, section = '', showFooter = false }: { children: ReactNode; section?: string; showFooter?: boolean }) {
  // Null while the catalog loads: the shell renders without catalog-dependent parts.
  const loaded = useContext(CatalogContext);
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light');

  const toggleTheme = () => {
    const next = !light;
    document.documentElement.dataset.theme = next ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', next ? 'light' : 'dark');
    } catch {
      /* not persisted */
    }
    setLight(next);
  };

  return (
    <>
      <a
        className="skip"
        href="#app"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('app')?.focus();
        }}
      >
        {t.shell.skip}
      </a>
      <header className="topbar">
        <div className="topbar__inner">
          <a className="brand" href="#/">
            <span className="brand__mark" aria-hidden="true">
              {t.brand.mark}
            </span>
            <span>
              {t.brand.name} <span className="muted">{t.brand.suffix}</span>
            </span>
          </a>
          <nav className="nav" aria-label={t.shell.mainNav}>
            {NAV.map(([key, href, label]) => (
              <a key={key} href={href} aria-current={section === key ? 'page' : undefined}>
                {label}
                {key === 'stack' && loaded && <StackCount />}
              </a>
            ))}
          </nav>
          <button className="theme-btn" type="button" onClick={toggleTheme} aria-label={light ? t.shell.themeToDark : t.shell.themeToLight}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              />
            </svg>
          </button>
        </div>
      </header>
      <main id="app" className="container" tabIndex={-1}>
        {children}
      </main>
      {showFooter && loaded && (
        <footer className="footer">
          <div className="footer__inner">
            <span>{t.shell.updated(fmtDate(loaded.catalog.generatedAt))}</span>
            <nav aria-label={t.shell.footerNav}>
              <a href={repoUrl(loaded.catalog, '/blob/main/CONTRIBUTING.md')} target="_blank" rel="noopener noreferrer">
                {t.shell.contribute}
              </a>
              <a href={repoUrl(loaded.catalog, '/blob/main/docs/SECURITY.md')} target="_blank" rel="noopener noreferrer">
                {t.shell.security}
              </a>
              <a href="#/whats-new">{t.shell.releaseFeed}</a>
            </nav>
          </div>
        </footer>
      )}
    </>
  );
}
