#!/usr/bin/env node
// Builds the catalog site's data from the repository. Node >= 22, no dependencies.
// Reads .claude-plugin/marketplace.json and, per plugin, plugin.json, README.md,
// CHANGELOG.md, COMPATIBILITY.md and component files; writes into site/public/:
//   index.json  releases.json  stats.json  feed.xml  bodies/<id>.md
// The format is specified in docs/SITE-SPEC.md. Generated files are not committed.
//
// Usage: node scripts/build-index.mjs [--out site/public]
// Exit code: 0 = written, 1 = the catalog is broken (missing manifest, invalid JSON).

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = resolve(ROOT, outArg > -1 ? process.argv[outArg + 1] : 'site/public');
const BODIES = join(OUT, 'bodies');
const SEARCH_TEXT_LIMIT = 4000;

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const readIf = (p) => (existsSync(p) ? read(p) : null);
const rel = (p) => relative(ROOT, p).split(sep).join('/');

function fail(message) {
  console.error(`✖ build-index: ${message}`);
  process.exit(1);
}

function readJson(p) {
  try {
    return JSON.parse(read(p));
  } catch (e) {
    return fail(`${rel(p)}: ${e.message}`);
  }
}

// ---------- frontmatter ----------

/** Minimal YAML frontmatter: `key: value`, quoted strings, `>`/`|` blocks, `[a, b]` lists,
 * `- item` lists and one level of nested maps (ignored). Enough for SKILL.md and agents. */
export function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: md };
  const lines = m[1].split('\n');
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    let value = rawValue.trim();
    if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === '')) block.push(lines[++i].trim());
      value = value.startsWith('>') ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n').trim();
    } else if (value === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) items.push(unquote(lines[++i].replace(/^\s+-\s+/, '')));
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) i++; // nested map: skip
      value = items.length ? items : '';
    } else if (/^\[.*\]$/.test(value)) {
      value = value.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    } else {
      value = unquote(value);
    }
    data[key] = value;
  }
  return { data, body: md.slice(m[0].length) };
}

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  if (t === 'true') return true;
  if (t === 'false') return false;
  return t;
}

const list = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

// ---------- markdown helpers ----------

/** Markdown → plain text for search: no code fences, tables kept as words, no markup. */
export function plainText(md, limit = SEARCH_TEXT_LIMIT) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_|~]+/g, ' ')
    .replace(/(^|\s)-+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

/** Paragraphs of README.md before the first `## ` heading (after the title). */
function overview(readme) {
  if (!readme) return [];
  const intro = readme.replace(/^# .*\n/, '').split(/\n## /)[0];
  return intro
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('```') && !p.startsWith('|') && !p.startsWith('<'))
    .map((p) => plainText(p, 600))
    .slice(0, 3);
}

/** Keep a Changelog: `## [x.y.z] - YYYY-MM-DD`, `### Added` sections, `- ` bullets. */
export function parseChangelog(md) {
  if (!md) return [];
  const entries = [];
  let current = null;
  let section = '';
  let bullet = null;
  for (const line of md.split('\n')) {
    const head = line.match(/^##\s+\[?v?(\d+\.\d+\.\d+[^\]\s]*)\]?\s*(?:-\s*(\d{4}-\d{2}-\d{2}))?/);
    if (head) {
      current = { version: head[1], date: head[2] ?? null, changes: [] };
      entries.push(current);
      section = '';
      bullet = null;
      continue;
    }
    if (/^##\s/.test(line)) { current = null; continue; } // e.g. ## [Unreleased]
    if (!current) continue;
    const sec = line.match(/^###\s+(.+)/);
    if (sec) { section = sec[1].trim(); bullet = null; continue; }
    const item = line.match(/^[-*]\s+(.*)/);
    if (item) {
      bullet = `${section && !/^added$/i.test(section) ? `${section}: ` : ''}${item[1].trim()}`;
      current.changes.push(bullet);
      continue;
    }
    if (bullet !== null && /^\s+\S/.test(line)) {
      current.changes[current.changes.length - 1] += ` ${line.trim()}`;
    }
  }
  return entries.filter((e) => e.changes.length || e.date);
}

const minClaudeCode = (md) => md?.match(/Minimum:\s*\*{0,2}\s*(?:>=\s*)?v?(\d+\.\d+\.\d+)/i)?.[1] ?? null;

// ---------- components ----------

function componentId(plugin, type, name) {
  return `${plugin}--${type}--${name}`.replace(/[^A-Za-z0-9._-]/g, '-');
}

function skills(dir, plugin) {
  const base = join(dir, 'skills');
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((d) => existsSync(join(base, d, 'SKILL.md')))
    .sort()
    .map((d) => {
      const file = join(base, d, 'SKILL.md');
      const { data, body } = parseFrontmatter(read(file));
      const name = data.name || d;
      return {
        type: 'skill',
        name,
        description: data.description || '',
        keywords: list(data.keywords ?? data.tags),
        userInvocable: data['disable-model-invocation'] === true ? 'user-only' : data['user-invocable'] === false ? 'model-only' : 'both',
        argumentHint: data['argument-hint'] || null,
        file,
        body,
      };
    });
}

function agents(dir) {
  const base = join(dir, 'agents');
  if (!existsSync(base)) return [];
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name.endsWith('.md') && e.name !== 'README.md') files.push(join(d, e.name));
    }
  };
  walk(base);
  return files.sort().map((file) => {
    const { data, body } = parseFrontmatter(read(file));
    return {
      type: 'agent',
      name: data.name || file.split(sep).pop().replace(/\.md$/, ''),
      description: data.description || '',
      keywords: [],
      tools: list(data.tools),
      model: data.model || null,
      file,
      body,
    };
  });
}

function commands(dir) {
  const base = join(dir, 'commands');
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const file = join(base, f);
      const { data, body } = parseFrontmatter(read(file));
      return { type: 'command', name: f.replace(/\.md$/, ''), description: data.description || '', keywords: [], argumentHint: data['argument-hint'] || null, file, body };
    });
}

function hooks(dir) {
  const file = join(dir, 'hooks', 'hooks.json');
  if (!existsSync(file)) return [];
  const events = readJson(file).hooks ?? {};
  const out = [];
  for (const [event, groups] of Object.entries(events)) {
    for (const group of groups) {
      for (const h of group.hooks ?? []) {
        const command = h.command ?? h.url ?? h.prompt ?? '';
        const script = command.match(/([\w.-]+\.(?:mjs|js|sh|py|ts))/)?.[1];
        out.push({
          type: 'hook',
          name: script ? script.replace(/\.[^.]+$/, '') : `${event}-${out.length + 1}`,
          description: hookDescription(dir, script) || `Runs on ${event}${group.matcher ? ` for ${group.matcher}` : ''}.`,
          keywords: [],
          event,
          matcher: group.matcher ?? '',
          command,
          file,
          body: `\`\`\`json\n${JSON.stringify({ [event]: [group] }, null, 2)}\n\`\`\`\n`,
        });
      }
    }
  }
  return out;
}

/** The first comment paragraph of the hook script, when it has one. */
function hookDescription(dir, script) {
  if (!script) return '';
  const file = join(dir, 'scripts', script);
  const src = readIf(file);
  if (!src) return '';
  const comment = src.split('\n').filter((l) => /^\/\/|^#(?!!)/.test(l)).map((l) => l.replace(/^(\/\/|#)\s?/, ''));
  return comment.join(' ').split(/\.\s/)[0].replace(/\s+/g, ' ').trim().slice(0, 240);
}

function mcpServers(dir) {
  const file = join(dir, '.mcp.json');
  if (!existsSync(file)) return [];
  const json = readJson(file);
  const servers = json.mcpServers ?? json;
  return Object.entries(servers).map(([name, cfg]) => {
    const url = cfg.url ? new URL(cfg.url) : null;
    return {
      type: 'mcp',
      name,
      description: cfg.description || `MCP server${url ? ` at ${url.host}` : ''}.`,
      keywords: [],
      transport: cfg.type || (cfg.url ? 'http' : 'stdio'),
      hosts: url ? [url.host] : [],
      file,
      body: `\`\`\`json\n${JSON.stringify({ [name]: cfg }, null, 2)}\n\`\`\`\n`,
    };
  });
}

// ---------- git ----------

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = git(['remote', 'get-url', 'origin']);
  return url.match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1] ?? null;
}

// ---------- main ----------

function main() {
  const catalogPath = join(ROOT, '.claude-plugin', 'marketplace.json');
  if (!existsSync(catalogPath)) fail('.claude-plugin/marketplace.json not found');
  const catalog = readJson(catalogPath);
  const repo = repoSlug();
  const branch = process.env.GITHUB_REF_NAME && !process.env.GITHUB_HEAD_REF ? process.env.GITHUB_REF_NAME : 'main';

  rmSync(BODIES, { recursive: true, force: true });
  mkdirSync(BODIES, { recursive: true });
  const writeBody = (id, md) => {
    writeFileSync(join(BODIES, `${id}.md`), md);
    return `bodies/${id}.md`;
  };

  const plugins = [];
  for (const entry of catalog.plugins ?? []) {
    if (typeof entry.source !== 'string') {
      console.warn(`⚠ ${entry.name}: remote source skipped`);
      continue;
    }
    const dir = resolve(ROOT, entry.source);
    const manifestPath = join(dir, '.claude-plugin', 'plugin.json');
    if (!existsSync(manifestPath)) fail(`${entry.name}: ${rel(manifestPath)} is missing`);
    const m = readJson(manifestPath);
    const readme = readIf(join(dir, 'README.md'));
    const changelog = parseChangelog(readIf(join(dir, 'CHANGELOG.md')));

    const components = [...skills(dir, m.name), ...agents(dir), ...commands(dir), ...hooks(dir), ...mcpServers(dir)].map((c) => {
      const id = componentId(m.name, c.type, c.name);
      const { file, body, ...rest } = c;
      return {
        id,
        ...rest,
        path: rel(file),
        body: writeBody(id, body.trim() + '\n'),
        searchText: plainText(body),
      };
    });

    plugins.push({
      name: m.name,
      displayName: m.displayName || entry.displayName || titleCase(m.name),
      version: m.version ?? null,
      description: m.description || entry.description || '',
      author: m.author?.name ?? catalog.owner?.name ?? '',
      license: m.license ?? null,
      keywords: m.keywords ?? entry.keywords ?? [],
      category: entry.category ?? null,
      minClaudeCode: minClaudeCode(readIf(join(dir, 'COMPATIBILITY.md'))),
      updatedAt: changelog.find((e) => e.date)?.date ?? null,
      source: entry.source,
      overview: overview(readme),
      readme: readme ? writeBody(`plugin--${m.name}`, readme) : null,
      readmeText: plainText(readme ?? ''),
      dependencies: (m.dependencies ?? []).map((d) => (typeof d === 'string' ? { name: d, version: null } : { name: d.name, version: d.version ?? null })),
      usedBy: [],
      userConfig: Object.entries(m.userConfig ?? {}).map(([key, v]) => ({ key, description: v.description ?? '', sensitive: Boolean(v.sensitive) })),
      components,
      changelog,
    });
  }

  for (const p of plugins)
    for (const d of p.dependencies) plugins.find((q) => q.name === d.name)?.usedBy.push(p.name);

  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const index = {
    schemaVersion: 2,
    generatedAt,
    marketplace: {
      name: catalog.name,
      description: catalog.description ?? '',
      owner: catalog.owner?.name ?? '',
      repo,
      branch,
    },
    plugins,
  };

  const releases = plugins
    .flatMap((p) =>
      p.changelog.map((e, i) => ({
        plugin: p.name,
        displayName: p.displayName,
        version: e.version,
        date: e.date,
        changes: e.changes,
        breaking: isBreaking(e),
        firstRelease: i === p.changelog.length - 1,
        latest: e.version === p.version,
      })),
    )
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.plugin.localeCompare(b.plugin));

  const byType = {};
  for (const p of plugins) for (const c of p.components) byType[c.type] = (byType[c.type] ?? 0) + 1;
  const stats = {
    generatedAt,
    plugins: plugins.length,
    components: Object.values(byType).reduce((a, b) => a + b, 0),
    byType,
    releases: releases.length,
    latestRelease: releases[0] ? { plugin: releases[0].plugin, version: releases[0].version, date: releases[0].date } : null,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  writeFileSync(join(OUT, 'releases.json'), JSON.stringify(releases, null, 2) + '\n');
  writeFileSync(join(OUT, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
  writeFileSync(join(OUT, 'feed.xml'), atom(index, releases));

  console.log(`✔ ${rel(OUT)}: ${plugins.length} plugins, ${stats.components} components, ${releases.length} releases`);
}

const isBreaking = (e) => e.changes.some((c) => /^(BREAKING|Removed:|Changed:.*breaking)/i.test(c)) || (/^\d+\.0\.0$/.test(e.version) && e.changes.some((c) => /breaking/i.test(c)));
const titleCase = (s) => s.split('-').map((w) => (w.length <= 3 && w === 'sdd' ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(' ');
const xml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

function atom(index, releases) {
  const site = index.marketplace.repo ? `https://${index.marketplace.repo.split('/')[0]}.github.io/${index.marketplace.repo.split('/')[1]}/` : '';
  const entries = releases.slice(0, 50).map((r) => `  <entry>
    <id>urn:${xml(index.marketplace.name)}:${xml(r.plugin)}:${xml(r.version)}</id>
    <title>${xml(r.displayName)} ${xml(r.version)}</title>
    <updated>${xml(r.date ?? index.generatedAt.slice(0, 10))}T00:00:00Z</updated>
    <link href="${xml(site)}#/plugin/${xml(r.plugin)}"/>
    <content type="text">${xml(r.changes.join('\n'))}</content>
  </entry>`);
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:${xml(index.marketplace.name)}:releases</id>
  <title>${xml(index.marketplace.name)} releases</title>
  <updated>${xml(index.generatedAt)}</updated>
  <link href="${xml(site)}#/whats-new"/>
${entries.join('\n')}
</feed>
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
