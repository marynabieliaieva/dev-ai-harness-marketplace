import { t } from '../i18n';
import { useCatalog } from '../lib/catalog';
import { fmtDate, installId } from '../lib/format';
import type { Doc } from '../lib/search';
import { useApp } from './state';
import { Badge, CopyButton, Highlight } from './ui';

export function Card({ doc, terms = [] }: { doc: Doc; terms?: string[] }) {
  const { catalog, plugins } = useCatalog();
  const { stack, toggleStack } = useApp();
  const p = plugins.get(doc.plugin)!;
  const isPlugin = doc.type === 'plugin';
  const inStack = stack.has(p.name);

  return (
    <article className="card">
      <div className="card__head">
        <Badge type={doc.type} />
        {p.version && <span className="version">v{p.version}</span>}
      </div>
      <a className="card__title" href={doc.href}>
        {isPlugin ? (
          doc.title
        ) : (
          <>
            <span className="card__ns">{p.name}:</span>
            {doc.name}
          </>
        )}
      </a>
      <p className="card__desc">
        <Highlight text={doc.description} terms={terms} />
      </p>
      <div className="card__foot">
        <span>{isPlugin ? `${t.count.components(p.components.length)} · ${fmtDate(p.updatedAt)}` : t.card.inPlugin(p.displayName)}</span>
        <span className="actions">
          <CopyButton className="btn btn--card" text={`/plugin install ${installId(catalog, p.name)}`} ariaLabel={t.card.copyInstallAria(p.name)}>
            {t.card.copyInstall}
          </CopyButton>
          <button
            className="btn btn--card btn--stack"
            type="button"
            aria-pressed={inStack}
            aria-label={inStack ? t.card.removeFromStack(p.name) : t.card.addToStack(p.name)}
            onClick={() => toggleStack(p.name)}
          >
            {inStack ? '✓' : '+'}
          </button>
        </span>
      </div>
    </article>
  );
}
