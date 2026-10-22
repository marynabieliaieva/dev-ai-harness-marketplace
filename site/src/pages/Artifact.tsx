import { Badge, CodeLine, CopyButton, Markdown, useTitle } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { TYPE_LABEL, WRITE_TOOLS, fileUrl, installId, usage } from '../lib/format';
import { NotFound } from './NotFound';

const HOW: Record<string, string> = {
  'user-only': 'Run it yourself — Claude never starts it on its own.',
  'model-only': 'Claude loads it when the task matches its description; it has no slash command.',
  both: 'Claude loads it when the task matches; you can also run it by name.',
};

export function Artifact({ id }: { id: string }) {
  const { catalog, components } = useCatalog();
  const hit = components.get(id);
  useTitle(hit ? `${hit.plugin.name}:${hit.component.name}` : 'Not found');
  if (!hit) return <NotFound message={`There is no component with the id “${id}”.`} />;

  const { plugin: p, component: c } = hit;
  const use = usage(p, c);
  const source = fileUrl(catalog, c.path);

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/">Explore</a> / <a href={`#/plugin/${p.name}`}>{p.name}</a> / {c.name}
      </nav>
      <div className="layout">
        <div className="layout__main">
          <section className="plugin-intro">
            <div className="artifact-head">
              <Badge type={c.type} />
              <h1>
                <span className="card__ns">{p.name}:</span>
                {c.name}
              </h1>
            </div>
            <p className="lead">{c.description}</p>
          </section>
          <section className="section" aria-labelledby="h-body">
            <h2 id="h-body">{c.type === 'hook' || c.type === 'mcp' ? 'Configuration' : 'Definition'}</h2>
            <Markdown path={c.body} base={source} />
          </section>
        </div>

        <aside className="layout__aside">
          <div className="panel">
            <h2>Use</h2>
            {use ? <CodeLine text={use} /> : <p className="muted" style={{ fontSize: 13 }}>Not called by name.</p>}
            {c.type === 'skill' && c.userInvocable && <p className="hint">{HOW[c.userInvocable]}</p>}
            {c.argumentHint && (
              <p className="hint">
                Arguments: <code>{c.argumentHint}</code>
              </p>
            )}
            {c.type === 'agent' && <p className="hint">Claude delegates to it when the task matches; mention it to call it explicitly.</p>}
            <h2 style={{ marginTop: 6 }}>Comes with</h2>
            <CodeLine text={`/plugin install ${installId(catalog, p.name)}`} />
          </div>
          <div className="panel panel--loose">
            <h2>Details</h2>
            <dl className="kv">
              <dt>Type</dt>
              <dd>{TYPE_LABEL[c.type]}</dd>
              <dt>Plugin</dt>
              <dd>
                <a href={`#/plugin/${p.name}`}>{p.displayName}</a> <code>v{p.version}</code>
              </dd>
              {c.model && (
                <>
                  <dt>Model</dt>
                  <dd>
                    <code>{c.model}</code>
                  </dd>
                </>
              )}
              {c.event && (
                <>
                  <dt>Event</dt>
                  <dd>
                    <code>{c.event}</code>
                  </dd>
                </>
              )}
              {c.matcher && (
                <>
                  <dt>Matcher</dt>
                  <dd>
                    <code>{c.matcher}</code>
                  </dd>
                </>
              )}
              <dt>Source</dt>
              <dd>
                <a href={source} target="_blank" rel="noopener noreferrer">
                  {c.path.split('/').slice(-2).join('/')} ↗
                </a>
              </dd>
            </dl>
            {c.tools && c.tools.length > 0 && (
              <>
                <h2>Tools</h2>
                <div className="chips">
                  {c.tools.map((t) => (
                    <span key={t} className={`chip${WRITE_TOOLS.includes(t) ? ' chip--warn' : ''}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </>
            )}
            {c.command && (
              <>
                <h2>Command</h2>
                <div className="code">
                  <code>{c.command}</code>
                  <CopyButton text={c.command} />
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
