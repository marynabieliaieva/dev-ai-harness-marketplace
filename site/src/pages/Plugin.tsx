import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../components/state';
import { Badge, CodeLine, CopyButton, Markdown, useTitle } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { TYPES, WEB_TOOLS, WRITE_TOOLS, fileUrl, fmtDate, initials, installId, plural, repoUrl, usage } from '../lib/format';
import { hashFor } from '../lib/router';
import { load, save } from '../lib/storage';
import type { ChangelogEntry, Component, ComponentType, Plugin as PluginT } from '../lib/types';
import { NotFound } from './NotFound';

type Level = 'ok' | 'info' | 'warn';

function trustItems(p: PluginT): [Level, string, ReactNode][] {
  const items: [Level, string, ReactNode][] = [];
  const hooks = p.components.filter((c) => c.type === 'hook');
  const mcp = p.components.filter((c) => c.type === 'mcp');
  const agents = p.components.filter((c) => c.type === 'agent');
  const writers = agents.filter((a) => a.tools?.some((t) => WRITE_TOOLS.includes(t)));
  const browsers = agents.filter((a) => a.tools?.some((t) => WEB_TOOLS.includes(t)));
  const secrets = p.userConfig.filter((u) => u.sensitive);

  if (hooks.length) {
    const events = hooks.map((h) => `${h.event}${h.matcher ? ` (${h.matcher})` : ''}`).join(', ');
    items.push(['warn', '!', <><strong>Runs {plural(hooks.length, 'hook')}</strong> on your machine: {events}</>]);
  } else items.push(['ok', '✓', <><strong>No hooks</strong> run on your machine</>]);

  const hosts = [...new Set(mcp.flatMap((m) => m.hosts ?? []))];
  if (hosts.length) items.push(['warn', '↗', <><strong>Connects to</strong> {hosts.map((h) => <code key={h}>{h} </code>)}</>]);
  if (browsers.length) items.push(['info', '↗', <><strong>Agents can browse the web:</strong> {browsers.map((a) => a.name).join(', ')}</>]);
  if (!hosts.length && !browsers.length) items.push(['ok', '✓', <><strong>No network access</strong> declared</>]);

  if (writers.length) items.push(['warn', '✎', <><strong>Agents can edit files or run commands:</strong> {writers.map((a) => a.name).join(', ')}</>]);
  else if (agents.length) items.push(['ok', '✓', <><strong>Agents are read-only</strong></>]);

  if (secrets.length)
    items.push(['info', '*', <><strong>Asks for {plural(secrets.length, 'secret')}</strong> ({secrets.map((s) => s.key).join(', ')}), stored in your OS keychain</>]);
  return items;
}

export const isBreaking = (e: ChangelogEntry) => e.changes.some((c) => /^(BREAKING|Removed:)/i.test(c));

function ComponentRow({ p, c, target }: { p: PluginT; c: Component; target: string | null }) {
  const use = usage(p, c);
  const chip = (text: string, warn = false) => (
    <span key={text} className={`chip${warn ? ' chip--warn' : ''}`}>
      {text}
    </span>
  );
  return (
    <div className={`component${target === `${c.type}:${c.name}` ? ' is-target' : ''}`} id={`c-${c.type}-${c.name}`}>
      <a className="component__name" href={`#/artifact/${c.id}`}>
        {c.name}
      </a>
      <p className="component__desc">{c.description}</p>
      <div className="component__meta">
        {use && (
          <>
            <code>{use}</code>
            <CopyButton text={use} />
          </>
        )}
        {c.type === 'skill' && c.userInvocable === 'user-only' && chip('user-invoked only')}
        {c.tools?.map((t) => chip(t, WRITE_TOOLS.includes(t)))}
        {c.type === 'hook' && [chip(c.event ?? ''), c.matcher ? chip(`matcher: ${c.matcher}`) : null]}
        {c.type === 'mcp' && [chip(c.transport ?? ''), ...(c.hosts ?? []).map((h) => chip(h))]}
      </div>
    </div>
  );
}

function InstallPanel({ p }: { p: PluginT }) {
  const { catalog } = useCatalog();
  const [mode, setMode] = useState<'session' | 'shell'>(() => load('installMode', 'session'));
  const repo = catalog.marketplace.repo ?? '<owner>/<repo>';
  const lines =
    mode === 'shell'
      ? [`claude plugin marketplace add ${repo} --scope project`, `claude plugin install ${installId(catalog, p.name)} --scope project`]
      : [`/plugin marketplace add ${repo}`, `/plugin install ${installId(catalog, p.name)}`];
  const pick = (m: 'session' | 'shell') => {
    setMode(m);
    save('installMode', m);
  };
  return (
    <>
      <div className="seg" role="group" aria-label="Where to run">
        <button type="button" aria-pressed={mode === 'session'} onClick={() => pick('session')}>
          In a session
        </button>
        <button type="button" aria-pressed={mode === 'shell'} onClick={() => pick('shell')}>
          Shell · project
        </button>
      </div>
      {lines.map((l) => (
        <CodeLine key={l} text={l} />
      ))}
      <p className="hint">
        {mode === 'shell' ? 'Commit the .claude/settings.json it writes so the whole team gets it.' : 'Skip the first line if you already added the marketplace.'}
      </p>
    </>
  );
}

export function Plugin({ name, params }: { name: string; params: URLSearchParams }) {
  const { catalog, plugins } = useCatalog();
  const { stack, toggleStack } = useApp();
  const p = plugins.get(name);
  const target = params.get('c');
  useTitle(p ? p.displayName : 'Not found');

  useEffect(() => {
    if (target) document.getElementById(`c-${target.replace(':', '-')}`)?.scrollIntoView({ block: 'center' });
  }, [target, name]);

  if (!p) return <NotFound message={`There is no plugin called “${name}”.`} />;

  const groups = TYPES.filter((t): t is ComponentType => t !== 'plugin')
    .map((t) => [t, p.components.filter((c) => c.type === t)] as const)
    .filter(([, list]) => list.length);
  const inStack = stack.has(p.name);

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/">Explore</a> / {p.name}
      </nav>
      <div className="layout">
        <div className="layout__main">
          <section className="plugin-intro">
            <div className="plugin-head">
              <div className="avatar" aria-hidden="true">
                {initials(p.displayName)}
              </div>
              <div>
                <h1>{p.displayName}</h1>
                <div className="sub">
                  <code>{p.name}</code>
                  {p.version && <code style={{ fontWeight: 600 }}>v{p.version}</code>}
                  {p.updatedAt && <span>Updated {fmtDate(p.updatedAt)}</span>}
                  <span>by {p.author}</span>
                </div>
              </div>
            </div>
            <p className="lead">{p.description}</p>
            <div className="chips">
              {p.keywords.map((k) => (
                <a key={k} className="chip" href={hashFor('/search', { q: k })}>
                  {k}
                </a>
              ))}
            </div>
          </section>

          <section className="section components" aria-labelledby="h-components">
            <h2 id="h-components">
              Components <span className="faint" style={{ fontWeight: 500 }}>{p.components.length}</span>
            </h2>
            {groups.map(([t, list]) => (
              <div className="group" key={t}>
                <h3>
                  <Badge type={t} />
                  {list.length}
                </h3>
                <div className="list">
                  {list.map((c) => (
                    <ComponentRow key={c.id} p={p} c={c} target={target} />
                  ))}
                </div>
              </div>
            ))}
          </section>

          {p.readme && (
            <section className="section" aria-labelledby="h-docs">
              <h2 id="h-docs">Documentation</h2>
              <Markdown path={p.readme} base={fileUrl(catalog, `${p.source}/README.md`)} />
            </section>
          )}

          <section className="section" aria-labelledby="h-changelog">
            <h2 id="h-changelog">Changelog</h2>
            <ol className="timeline">
              {p.changelog.map((e) => (
                <li key={e.version} className={isBreaking(e) ? 'is-major' : ''}>
                  <span className="when">{fmtDate(e.date)}</span>
                  <h3>
                    <code>v{e.version}</code>
                    {isBreaking(e) && <span className="tag tag--breaking">Breaking</span>}
                  </h3>
                  <ul>
                    {e.changes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="layout__aside">
          <div className="panel">
            <h2>Install</h2>
            <InstallPanel p={p} />
            <button className="btn" type="button" aria-pressed={inStack} onClick={() => toggleStack(p.name)}>
              {inStack ? '✓ In install builder' : '+ Add to install builder'}
            </button>
          </div>
          <div className="panel panel--loose">
            <h2>Trust &amp; permissions</h2>
            <ul className="trust">
              {trustItems(p).map(([lvl, ic, node], i) => (
                <li key={i} className={`lvl-${lvl}`}>
                  <span className="ic" aria-hidden="true">
                    {ic}
                  </span>
                  <span>{node}</span>
                </li>
              ))}
            </ul>
            <a className="panel__link" href={repoUrl(catalog, '/blob/main/docs/SECURITY.md')} target="_blank" rel="noopener noreferrer">
              How plugins are reviewed →
            </a>
          </div>
          <div className="panel panel--loose">
            <h2>Details</h2>
            <dl className="kv">
              <dt>Version</dt>
              <dd>
                <code>{p.version ?? '—'}</code>
              </dd>
              <dt>Claude Code</dt>
              <dd>
                <code>{p.minClaudeCode ? `≥ ${p.minClaudeCode}` : 'any'}</code>
              </dd>
              <dt>License</dt>
              <dd>{p.license ?? '—'}</dd>
              <dt>Owner</dt>
              <dd>{p.author}</dd>
              <dt>Source</dt>
              <dd>
                <a href={repoUrl(catalog, `/tree/${catalog.marketplace.branch}/${p.source.replace(/^\.\//, '')}`)} target="_blank" rel="noopener noreferrer">
                  GitHub ↗
                </a>
              </dd>
            </dl>
          </div>
          <div className="panel">
            <h2>Dependencies</h2>
            {p.dependencies.length ? (
              <>
                <ul className="deps">
                  {p.dependencies.map((d) => (
                    <li key={d.name}>
                      <a href={`#/plugin/${d.name}`}>{d.name}</a>
                      <code>{d.version ?? 'any'}</code>
                    </li>
                  ))}
                </ul>
                <p className="hint">Installed automatically with this plugin.</p>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                None
              </p>
            )}
            {p.usedBy.length > 0 && (
              <>
                <h2 style={{ marginTop: 6 }}>Used by</h2>
                <ul className="deps">
                  {p.usedBy.map((n) => (
                    <li key={n}>
                      <a href={`#/plugin/${n}`}>{n}</a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
