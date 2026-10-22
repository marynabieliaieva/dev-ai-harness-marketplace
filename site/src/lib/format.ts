import type { Catalog, ComponentType, DocType, Plugin, Component } from './types';

export const TYPES: DocType[] = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];
export const TYPE_LABEL: Record<DocType, string> = { plugin: 'Plugin', skill: 'Skill', agent: 'Agent', command: 'Command', hook: 'Hook', mcp: 'MCP server' };
export const TYPE_PLURAL: Record<DocType, string> = { plugin: 'Plugins', skill: 'Skills', agent: 'Agents', command: 'Commands', hook: 'Hooks', mcp: 'MCP' };
export const WRITE_TOOLS = ['Write', 'Edit', 'Bash', 'NotebookEdit'];
export const WEB_TOOLS = ['WebSearch', 'WebFetch'];

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const initials = (s: string) => s.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const installId = (catalog: Catalog, name: string) => `${name}@${catalog.marketplace.name}`;
export const repoUrl = (catalog: Catalog, path = '') => (catalog.marketplace.repo ? `https://github.com/${catalog.marketplace.repo}${path}` : '#');
export const fileUrl = (catalog: Catalog, path: string) => repoUrl(catalog, `/blob/${catalog.marketplace.branch}/${path.replace(/^\.\//, '')}`);

/** How a user calls the component, or '' when it isn't called by name. */
export function usage(p: Plugin, c: Component): string {
  if (c.type === 'command') return `/${p.name}:${c.name}`;
  if (c.type === 'skill') return c.userInvocable === 'model-only' ? '' : `/${p.name}:${c.name}`;
  if (c.type === 'agent') return `@agent-${p.name}:${c.name}`;
  return '';
}

export const typeOrder = (t: ComponentType) => TYPES.indexOf(t);
