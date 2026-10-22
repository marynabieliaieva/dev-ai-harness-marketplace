import { Badge, CodeLine, CopyButton, Markdown, useTitle } from '../components/ui';
import { t } from '../i18n';
import { useCatalog } from '../lib/catalog';
import { TYPE_LABEL, WRITE_TOOLS, fileUrl, installId, usage } from '../lib/format';
import { NotFound } from './NotFound';

export function Artifact({ id }: { id: string }) {
  const { catalog, components } = useCatalog();
  const hit = components.get(id);
  useTitle(hit ? `${hit.plugin.name}:${hit.component.name}` : t.notFound.title);
  if (!hit) return <NotFound message={t.notFound.component(id)} />;

  const { plugin: p, component: c } = hit;
  const use = usage(p, c);
  const source = fileUrl(catalog, c.path);

  return (
    <div className="page">
      <nav className="crumbs" aria-label={t.common.breadcrumb}>
        <a href="#/">{t.common.explore}</a> / <a href={`#/plugin/${p.name}`}>{p.name}</a> / {c.name}
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
            <h2 id="h-body">{c.type === 'hook' || c.type === 'mcp' ? t.artifact.configuration : t.artifact.definition}</h2>
            <Markdown path={c.body} base={source} />
          </section>
        </div>

        <aside className="layout__aside">
          <div className="panel">
            <h2>{t.artifact.use}</h2>
            {use ? <CodeLine text={use} /> : <p className="muted" style={{ fontSize: 13 }}>{t.artifact.notCalled}</p>}
            {c.type === 'skill' && c.userInvocable && <p className="hint">{t.artifact.how[c.userInvocable]}</p>}
            {c.argumentHint && (
              <p className="hint">
                {t.artifact.arguments} <code>{c.argumentHint}</code>
              </p>
            )}
            {c.type === 'agent' && <p className="hint">{t.artifact.agentHint}</p>}
            <h2 style={{ marginTop: 6 }}>{t.artifact.comesWith}</h2>
            <CodeLine text={`/plugin install ${installId(catalog, p.name)}`} />
          </div>
          <div className="panel panel--loose">
            <h2>{t.artifact.details}</h2>
            <dl className="kv">
              <dt>{t.artifact.type}</dt>
              <dd>{TYPE_LABEL[c.type]}</dd>
              <dt>{t.artifact.plugin}</dt>
              <dd>
                <a href={`#/plugin/${p.name}`}>{p.displayName}</a> <code>v{p.version}</code>
              </dd>
              {c.model && (
                <>
                  <dt>{t.artifact.model}</dt>
                  <dd>
                    <code>{c.model}</code>
                  </dd>
                </>
              )}
              {c.event && (
                <>
                  <dt>{t.artifact.event}</dt>
                  <dd>
                    <code>{c.event}</code>
                  </dd>
                </>
              )}
              {c.matcher && (
                <>
                  <dt>{t.artifact.matcher}</dt>
                  <dd>
                    <code>{c.matcher}</code>
                  </dd>
                </>
              )}
              <dt>{t.artifact.source}</dt>
              <dd>
                <a href={source} target="_blank" rel="noopener noreferrer">
                  {c.path.split('/').slice(-2).join('/')} ↗
                </a>
              </dd>
            </dl>
            {c.tools && c.tools.length > 0 && (
              <>
                <h2>{t.artifact.tools}</h2>
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
                <h2>{t.artifact.command}</h2>
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
