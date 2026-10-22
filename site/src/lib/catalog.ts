import { createContext, useContext } from 'react';
import type { Catalog, Component, Plugin, Release, Stats } from './types';

export interface CatalogState {
  catalog: Catalog;
  releases: Release[];
  stats: Stats | null;
  plugins: Map<string, Plugin>;
  components: Map<string, { plugin: Plugin; component: Component }>;
}

/** Resolves a file under site/public against the deployed base path. */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

async function json<T>(path: string): Promise<T> {
  const res = await fetch(asset(path), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadCatalog(): Promise<CatalogState> {
  const [catalog, releases, stats] = await Promise.all([
    json<Catalog>('index.json'),
    json<Release[]>('releases.json').catch(() => [] as Release[]),
    json<Stats>('stats.json').catch(() => null),
  ]);
  const plugins = new Map(catalog.plugins.map((p) => [p.name, p]));
  const components = new Map(catalog.plugins.flatMap((p) => p.components.map((c) => [c.id, { plugin: p, component: c }] as const)));
  return { catalog, releases, stats, plugins, components };
}

const bodyCache = new Map<string, Promise<string>>();

/** Markdown of a component or plugin README (bodies/<id>.md), fetched once. */
export function loadBody(path: string): Promise<string> {
  if (!bodyCache.has(path)) {
    bodyCache.set(
      path,
      fetch(asset(path)).then((r) => {
        if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
        return r.text();
      }),
    );
  }
  return bodyCache.get(path)!;
}

export const CatalogContext = createContext<CatalogState | null>(null);

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog outside CatalogContext');
  return ctx;
}
