import { useEffect, useRef, useState } from 'react';
import { hashFor, replaceHash } from '../lib/router';

export const EXAMPLES = [
  'agent that writes a spec',
  'skill to run an implementation plan',
  'onion architecture',
  'hook that guards file writes',
  'research a library',
];

/** The hero search box. Typing updates #/search?q= in place, so the URL is shareable. */
export function SearchBox({ value, autoFocus = false }: { value: string; autoFocus?: boolean }) {
  const [q, setQ] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<number>();

  useEffect(() => setQ(value), [value]);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const go = (text: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const hash = hashFor('/search', { q: text });
      if (location.hash.startsWith('#/search')) replaceHash(hash);
      else location.hash = hash;
    }, 80);
  };

  return (
    <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
      <label className="sr-only" htmlFor="q">
        Search the marketplace
      </label>
      <svg className="search__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id="q"
        ref={ref}
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={q}
        placeholder="e.g. agent that writes a spec"
        onChange={(e) => {
          setQ(e.target.value);
          go(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setQ('');
            go('');
          }
        }}
      />
    </form>
  );
}

export function Examples() {
  return (
    <div className="examples" aria-label="Example searches">
      {EXAMPLES.map((e) => (
        <button key={e} type="button" onClick={() => (location.hash = hashFor('/search', { q: e }))}>
          {e}
        </button>
      ))}
    </div>
  );
}
