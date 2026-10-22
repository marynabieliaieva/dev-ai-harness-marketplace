import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

export function parseHash(hash = location.hash): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

export function hashFor(path: string, params: Record<string, string | null | undefined> = {}) {
  const entries = Object.entries(params).filter((e): e is [string, string] => e[1] != null && e[1] !== '');
  const qs = new URLSearchParams(entries).toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

/** Updates the hash without adding a history entry (typing in the search box). */
export function replaceHash(hash: string) {
  history.replaceState(null, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
