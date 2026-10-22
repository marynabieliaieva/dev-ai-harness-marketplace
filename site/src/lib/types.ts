// Shape of site/public/index.json — produced by scripts/build-index.mjs, specified in
// docs/SITE-SPEC.md.

export type ComponentType = 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
export type DocType = 'plugin' | ComponentType;

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  keywords: string[];
  path: string;
  body: string;
  searchText: string;
  tools?: string[];
  model?: string | null;
  userInvocable?: 'both' | 'user-only' | 'model-only';
  argumentHint?: string | null;
  event?: string;
  matcher?: string;
  command?: string;
  transport?: string;
  hosts?: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string | null;
  changes: string[];
}

export interface Plugin {
  name: string;
  displayName: string;
  version: string | null;
  description: string;
  author: string;
  license: string | null;
  keywords: string[];
  category: string | null;
  minClaudeCode: string | null;
  updatedAt: string | null;
  source: string;
  overview: string[];
  readme: string | null;
  readmeText: string;
  dependencies: { name: string; version: string | null }[];
  usedBy: string[];
  userConfig: { key: string; description: string; sensitive: boolean }[];
  components: Component[];
  changelog: ChangelogEntry[];
}

export interface Catalog {
  schemaVersion: number;
  generatedAt: string;
  marketplace: { name: string; description: string; owner: string; repo: string | null; branch: string };
  plugins: Plugin[];
}

export interface Release {
  plugin: string;
  displayName: string;
  version: string;
  date: string | null;
  changes: string[];
  breaking: boolean;
  firstRelease: boolean;
  latest: boolean;
}

export interface Stats {
  plugins: number;
  components: number;
  byType: Partial<Record<ComponentType, number>>;
  releases: number;
}
