import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadBody } from '../lib/catalog';
import { TYPE_LABEL } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';
import type { DocType } from '../lib/types';
import { useApp } from './state';

export function Badge({ type }: { type: DocType }) {
  return <span className={`badge t-${type}`}>{TYPE_LABEL[type]}</span>;
}

export function CopyButton({ text, label, className = 'btn btn--sm', children = 'Copy', ariaLabel }: {
  text: string;
  label?: string;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
}) {
  const { copy } = useApp();
  return (
    <button className={className} type="button" onClick={() => copy(text, label)} aria-label={ariaLabel ?? `Copy: ${text}`}>
      {children}
    </button>
  );
}

export function CodeLine({ text }: { text: string }) {
  return (
    <div className="code">
      <code>{text}</code>
      <CopyButton text={text} />
    </div>
  );
}

export function CopyBlock({ text }: { text: string }) {
  return (
    <div className="copy-wrap">
      <pre className="block">{text}</pre>
      <CopyButton text={text} label="Copied" ariaLabel="Copy" />
    </div>
  );
}

/** Text with every word that starts with a search term wrapped in <mark>. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const parts = useMemo(() => {
    const usable = terms.filter((t) => t.length >= 2);
    if (!usable.length) return [text];
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${usable.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[\\p{L}\\p{N}]*`, 'giu');
    const out: (string | { mark: string })[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      out.push(text.slice(last, m.index), { mark: m[0] });
      last = (m.index ?? 0) + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  }, [text, terms]);
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{typeof p === 'string' ? p : <mark>{p.mark}</mark>}</Fragment>
      ))}
    </>
  );
}

/** Repository markdown, rendered and sanitized (lib/markdown.ts). */
export function Markdown({ path, base }: { path: string; base: string }) {
  const [state, setState] = useState<{ html: string } | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    setState(null);
    loadBody(path)
      .then((md) => live && setState({ html: renderMarkdown(md, base) }))
      .catch((e: Error) => live && setState({ error: e.message }));
    return () => {
      live = false;
    };
  }, [path, base]);

  if (!state) return <p className="muted">Loading…</p>;
  if ('error' in state) return <p className="muted">Could not load this document ({state.error}).</p>;
  // eslint-disable-next-line react/no-danger -- sanitized by DOMPurify in renderMarkdown
  return <div className="md" dangerouslySetInnerHTML={{ __html: state.html }} />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — DevDigest Marketplace` : 'DevDigest Marketplace';
  }, [title]);
}
