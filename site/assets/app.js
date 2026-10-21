// DevDigest Marketplace — static catalog site for GitHub Pages. No build step, no backend.
// Data: public/index.json (generated in CI from the repository), falling back to
// public/index.sample.json. Routes (hash-based, so Pages needs no rewrites):
//   #/?q=&type=         Explore — search with cards
//   #/plugin/<name>?c=  Plugin page; c=<type>:<component> highlights a component
//   #/stack?p=&scope=   Install builder
//   #/releases?plugin=  Release feed

import { TYPES, buildDocs, highlight, search } from './search.js';

const TYPE_LABEL = { plugin: 'Plugin', skill: 'Skill', agent: 'Agent', command: 'Command', hook: 'Hook', mcp: 'MCP server' };
const TYPE_PLURAL = { plugin: 'Plugins', skill: 'Skills', agent: 'Agents', command: 'Commands', hook: 'Hooks', mcp: 'MCP' };
const EXAMPLES = [
  'skill to break a feature into tasks',
  'agent for competitor research',
  'hook that blocks dangerous commands',
  'write an architecture decision',
  'review a pull request',
];
const WRITE_TOOLS = ['Write', 'Edit', 'Bash', 'NotebookEdit'];
const WEB_TOOLS = ['WebSearch', 'WebFetch'];

const app = document.getElementById('app');
const state = { catalog: null, docs: [], plugins: new Map(), usedBy: new Map(), isSample: false, stack: loadStack() };

// ---------- utilities ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (s) => s.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const mkt = () => state.catalog.marketplace;
const repoUrl = (path = '') => `https://github.com/${mkt().repo}${path}`;
const installId = (name) => `${name}@${mkt().name}`;

function storage(fn, fallback) {
  try { return fn(localStorage); } catch { return fallback; }
}
function loadStack() {
  return new Set(storage((s) => JSON.parse(s.getItem('stack') ?? '[]'), []));
}
function saveStack() {
  storage((s) => s.setItem('stack', JSON.stringify([...state.stack])));
  const count = document.getElementById('stack-count');
  count.textContent = state.stack.size;
  count.hidden = state.stack.size === 0;
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 1800);
}

async function copy(text, label = `Copied: ${text}`) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(label);
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

function hashFor(path, params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

// ---------- shared fragments ----------

const badge = (type) => `<span class="badge t-${type}">${TYPE_LABEL[type]}</span>`;

function codeLine(text) {
  return `<div class="code"><code>${esc(text)}</code><button class="btn btn--sm" type="button" data-copy="${esc(text)}" aria-label="Copy: ${esc(text)}">Copy</button></div>`;
}

function copyBlock(text) {
  return `<div class="copy-wrap"><pre class="block">${esc(text)}</pre><button class="btn btn--sm" type="button" data-copy="${esc(text)}" data-copy-label="Copied">Copy</button></div>`;
}

function stackButton(name) {
  const on = state.stack.has(name);
  return `<button class="btn" type="button" data-stack="${esc(name)}" aria-pressed="${on}">${on ? '✓ In install builder' : '+ Add to install builder'}</button>`;
}

function usage(p, c) {
  if (c.type === 'skill' || c.type === 'command') return `/${p.name}:${c.name}`;
  if (c.type === 'agent') return `${p.name}:${c.name}`;
  return '';
}

// ---------- Explore ----------

function renderExplore(params) {
  const q = params.get('q') ?? '';
  const pluginCount = state.catalog.plugins.length;
  const componentCount = state.docs.length - pluginCount;
  document.title = q ? `“${q}” — DevDigest Marketplace` : 'DevDigest Marketplace';

  app.innerHTML = `
    <section class="hero">
      <h1>Find the right skill, agent or plugin</h1>
      <p>Search ${plural(pluginCount, 'plugin')} and ${plural(componentCount, 'component')} for Claude Code. Describe what you need in plain words.</p>
      <form class="search" role="search" id="search-form">
        <label class="sr-only" for="q">Search the marketplace</label>
        <svg class="search__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input id="q" type="search" autocomplete="off" spellcheck="false" value="${esc(q)}"
          placeholder="e.g. skill to break a feature into tasks">
      </form>
      <div class="examples" aria-label="Example searches">
        ${EXAMPLES.map((e) => `<button type="button" data-example="${esc(e)}">${esc(e)}</button>`).join('')}
      </div>
    </section>
    <div class="toolbar">
      <div class="tabs" id="tabs" role="toolbar" aria-label="Filter by type"></div>
      <span class="toolbar__note">Sorted by relevance</span>
    </div>
    <p class="result-meta" id="meta" aria-live="polite"></p>
    <div id="results"></div>`;

  renderResults(params);
}

function currentParams() {
  return parseHash().params;
}

function updateExplore(changes) {
  const params = currentParams();
  for (const [k, v] of Object.entries(changes)) {
    if (v === '' || v == null) params.delete(k);
    else params.set(k, v);
  }
  history.replaceState(null, '', hashFor('/', Object.fromEntries(params)));
  renderResults(params);
}

function renderResults(params) {
  const q = params.get('q') ?? '';
  const explicitType = params.get('type'); // absent = let the query's words pick the type
  const hasQuery = q.trim() !== '';

  const all = search(state.docs, q, { type: 'all', useIntent: false });
  const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
  for (const r of all.results) counts[r.doc.type]++;

  // Empty query + no filter: browse plugins, the natural entry point.
  const type = explicitType ?? (hasQuery ? undefined : 'plugin');
  const { results, terms, intentType, effectiveType } = search(state.docs, q, { type: type ?? 'all', useIntent: !explicitType });

  const tabs = [['all', 'All', hasQuery ? all.results.length : state.docs.length], ...TYPES.map((t) => [t, TYPE_PLURAL[t], counts[t]])];
  document.getElementById('tabs').innerHTML = tabs
    .filter(([t, , n]) => t === 'all' || n > 0 || t === effectiveType)
    .map(([t, label, n]) => `<button class="tab t-${t}" type="button" data-type="${t}" aria-pressed="${effectiveType === t}"><span class="dot"></span>${label} <span class="count">${n}</span></button>`)
    .join('');

  const meta = document.getElementById('meta');
  if (!hasQuery) {
    meta.textContent = effectiveType === 'plugin' ? `Browse all ${plural(results.length, 'plugin')}`
      : `${results.length} ${effectiveType === 'all' ? (results.length === 1 ? 'item' : 'items') : TYPE_PLURAL[effectiveType].toLowerCase()}`;
  } else {
    const intent = !explicitType && intentType
      ? ` · showing ${TYPE_PLURAL[intentType].toLowerCase()} because your search mentions “${intentType}” <button type="button" data-type="all">Show all types</button>`
      : '';
    meta.innerHTML = `${plural(results.length, 'result')} for “${esc(q)}”${intent}`;
  }

  const box = document.getElementById('results');
  if (!results.length) {
    box.innerHTML = `
      <div class="empty">
        <h2>Nothing matches “${esc(q)}” yet</h2>
        <p>Try fewer or different words, or browse everything. If it doesn't exist, ask for it.</p>
        <div class="row">
          <button class="btn" type="button" data-example="">Clear search</button>
          <a class="btn btn--primary" target="_blank" rel="noopener" href="${esc(requestUrl(q))}">Request this skill</a>
        </div>
      </div>`;
    return;
  }
  box.innerHTML = `<div class="grid">${results.map((r) => card(r.doc, terms)).join('')}</div>`;
}

function requestUrl(q) {
  const title = `Skill request: ${q}`.slice(0, 120);
  return repoUrl(`/issues/new?labels=plugin-request&title=${encodeURIComponent(title)}`);
}

function card(doc, terms) {
  const p = state.plugins.get(doc.plugin);
  const isPlugin = doc.type === 'plugin';
  const href = isPlugin ? `#/plugin/${p.name}` : `#/plugin/${p.name}?c=${doc.type}:${encodeURIComponent(doc.name)}`;
  const title = isPlugin ? esc(doc.title) : `<span class="card__ns">${esc(p.name)}:</span>${esc(doc.name)}`;
  const foot = isPlugin
    ? `${plural(p.components.length, 'component')} · ${fmtDate(p.updatedAt)}`
    : `in ${esc(p.displayName || p.name)}`;
  const inStack = state.stack.has(p.name);
  return `
    <article class="card">
      <div class="card__head">${badge(doc.type)}<span class="version">v${esc(p.version)}</span></div>
      <a class="card__title" href="${href}">${title}</a>
      <p class="card__desc">${highlight(doc.description, terms)}</p>
      <div class="card__foot">
        <span>${foot}</span>
        <span class="actions">
          <button class="btn btn--card" type="button" data-copy="/plugin install ${esc(installId(p.name))}">Copy install</button>
          <button class="btn btn--card btn--stack" type="button" data-stack="${esc(p.name)}" aria-pressed="${inStack}"
            aria-label="${inStack ? `Remove ${esc(p.name)} from` : `Add ${esc(p.name)} to`} the install builder">${inStack ? '✓' : '+'}</button>
        </span>
      </div>
    </article>`;
}

// ---------- Plugin page ----------

function trustItems(p) {
  const items = [];
  const hooks = p.components.filter((c) => c.type === 'hook');
  const mcp = p.components.filter((c) => c.type === 'mcp');
  const agents = p.components.filter((c) => c.type === 'agent');
  const writers = agents.filter((a) => a.tools?.some((t) => WRITE_TOOLS.includes(t)));
  const browsers = agents.filter((a) => a.tools?.some((t) => WEB_TOOLS.includes(t)));
  const secrets = (p.userConfig ?? []).filter((u) => u.sensitive);

  if (hooks.length) {
    const events = hooks.map((h) => `${h.event}${h.matcher ? ` (${h.matcher})` : ''}`).join(', ');
    items.push(['warn', '!', `<strong>Runs ${plural(hooks.length, 'hook')}</strong> on your machine: ${esc(events)}`]);
  } else items.push(['ok', '✓', '<strong>No hooks</strong> run on your machine']);

  const hosts = [...new Set(mcp.flatMap((m) => m.hosts ?? []))];
  if (hosts.length) items.push(['warn', '↗', `<strong>Connects to</strong> ${hosts.map((h) => `<code>${esc(h)}</code>`).join(', ')}`]);
  if (browsers.length) items.push(['info', '↗', `<strong>Agents can browse the web:</strong> ${esc(browsers.map((a) => a.name).join(', '))}`]);
  if (!hosts.length && !browsers.length) items.push(['ok', '✓', '<strong>No network access</strong> declared']);

  if (writers.length) items.push(['warn', '✎', `<strong>Agents can edit files or run commands:</strong> ${esc(writers.map((a) => a.name).join(', '))}`]);
  else if (agents.length) items.push(['ok', '✓', '<strong>Agents are read-only</strong>']);

  if (secrets.length) items.push(['info', '*', `<strong>Asks for ${plural(secrets.length, 'secret')}</strong> (${esc(secrets.map((s) => s.key).join(', '))}), stored in your OS keychain`]);
  return items;
}

function componentRow(p, c, target) {
  const id = `c-${c.type}-${c.name}`;
  const use = usage(p, c);
  const chip = (text, warn = false) => `<span class="chip${warn ? ' chip--warn' : ''}">${esc(text)}</span>`;
  const meta = [];
  if (use) meta.push(`<code>${esc(use)}</code><button class="btn btn--sm" type="button" data-copy="${esc(use)}" aria-label="Copy: ${esc(use)}">Copy</button>`);
  if (c.tools) meta.push(...c.tools.map((t) => chip(t, WRITE_TOOLS.includes(t))));
  if (c.type === 'hook') meta.push(chip(c.event), c.matcher ? chip(`matcher: ${c.matcher}`) : '', chip(c.command));
  if (c.type === 'mcp') meta.push(chip(c.transport), ...(c.hosts ?? []).map((h) => chip(h)));
  return `
    <div class="component${target === `${c.type}:${c.name}` ? ' is-target' : ''}" id="${esc(id)}">
      <span class="component__name">${esc(c.name)}</span>
      <p class="component__desc">${esc(c.description)}</p>
      ${meta.length ? `<div class="component__meta">${meta.join('')}</div>` : ''}
    </div>`;
}

function installPanel(p, mode) {
  const lines = mode === 'shell'
    ? [`claude plugin marketplace add ${mkt().repo} --scope project`, `claude plugin install ${installId(p.name)} --scope project`]
    : [`/plugin marketplace add ${mkt().repo}`, `/plugin install ${installId(p.name)}`];
  return `
    <div class="seg" role="group" aria-label="Where to run">
      <button type="button" data-install-mode="session" aria-pressed="${mode !== 'shell'}">In a session</button>
      <button type="button" data-install-mode="shell" aria-pressed="${mode === 'shell'}">Shell · project</button>
    </div>
    ${lines.map((l) => codeLine(l)).join('')}
    <p class="hint">${mode === 'shell'
      ? 'Commit the .claude/settings.json it writes so the whole team gets it.'
      : 'Skip the first line if you already added the marketplace.'}</p>`;
}

function renderPlugin(name, params) {
  const p = state.plugins.get(name);
  if (!p) return renderNotFound(`There is no plugin called “${name}”.`);
  document.title = `${p.displayName || p.name} — DevDigest Marketplace`;
  const target = params.get('c');
  const mode = storage((s) => s.getItem('installMode'), null) ?? 'session';

  const groups = TYPES.filter((t) => t !== 'plugin')
    .map((t) => [t, p.components.filter((c) => c.type === t)])
    .filter(([, list]) => list.length);
  const deps = p.dependencies ?? [];
  const usedBy = state.usedBy.get(p.name) ?? [];

  app.innerHTML = `
    <div class="page">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Explore</a> / ${esc(p.name)}</nav>
      <div class="layout">
        <div class="layout__main">
          <section class="plugin-intro">
            <div class="plugin-head">
              <div class="avatar" aria-hidden="true">${esc(initials(p.displayName || p.name))}</div>
              <div>
                <h1>${esc(p.displayName || p.name)}</h1>
                <div class="sub">
                  <code>${esc(p.name)}</code>
                  <code style="font-weight:600">v${esc(p.version)}</code>
                  <span>Updated ${fmtDate(p.updatedAt)}</span>
                  <span>by ${esc(p.author)}</span>
                </div>
              </div>
            </div>
            <p class="lead">${esc(p.description)}</p>
            <div class="chips">${(p.keywords ?? []).map((k) => `<a class="chip" href="${hashFor('/', { q: k })}">${esc(k)}</a>`).join('')}</div>
            ${(p.overview ?? []).length ? `<div class="prose">${p.overview.map((para) => `<p>${esc(para)}</p>`).join('')}</div>` : ''}
          </section>

          <section class="section components" aria-labelledby="h-components">
            <h2 id="h-components">Components <span class="faint" style="font-weight:500">${p.components.length}</span></h2>
            ${groups.map(([t, list]) => `
              <div class="group">
                <h3>${badge(t)}${list.length}</h3>
                <div class="list">${list.map((c) => componentRow(p, c, target)).join('')}</div>
              </div>`).join('')}
          </section>

          <section class="section" aria-labelledby="h-changelog">
            <h2 id="h-changelog">Changelog</h2>
            <ol class="timeline">
              ${p.changelog.map((e) => `
                <li class="${isBreaking(e) ? 'is-major' : ''}">
                  <span class="when">${fmtDate(e.date)}</span>
                  <h3><code>v${esc(e.version)}</code>${isBreaking(e) ? '<span class="tag tag--breaking">Breaking</span>' : ''}</h3>
                  <ul>${e.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
                </li>`).join('')}
            </ol>
          </section>
        </div>

        <aside class="layout__aside">
          <div class="panel">
            <h2>Install</h2>
            <div id="install" style="display:contents">${installPanel(p, mode)}</div>
            ${stackButton(p.name)}
          </div>
          <div class="panel panel--loose">
            <h2>Trust &amp; permissions</h2>
            <ul class="trust">${trustItems(p).map(([lvl, ic, html]) => `<li class="lvl-${lvl}"><span class="ic" aria-hidden="true">${ic}</span><span>${html}</span></li>`).join('')}</ul>
            <a class="panel__link" href="${repoUrl('/blob/main/docs/SECURITY.md')}" target="_blank" rel="noopener">How plugins are reviewed →</a>
          </div>
          <div class="panel panel--loose">
            <h2>Details</h2>
            <dl class="kv">
              <dt>Version</dt><dd><code>${esc(p.version)}</code></dd>
              <dt>Claude Code</dt><dd><code>≥ ${esc(p.minClaudeCode)}</code></dd>
              <dt>License</dt><dd>${esc(p.license)}</dd>
              <dt>Source</dt><dd><a href="${repoUrl(`/tree/${mkt().branch}/${p.source.replace(/^\.\//, '')}`)}" target="_blank" rel="noopener">GitHub ↗</a></dd>
            </dl>
          </div>
          <div class="panel">
            <h2>Dependencies</h2>
            ${deps.length
              ? `<ul class="deps">${deps.map((d) => `<li><a href="#/plugin/${esc(d.name)}">${esc(d.name)}</a><code>${esc(d.version ?? 'any')}</code></li>`).join('')}</ul>
                 <p class="hint">Installed automatically with this plugin.</p>`
              : '<p class="muted" style="font-size:13px">None</p>'}
            ${usedBy.length ? `<h2 style="margin-top:6px">Used by</h2><ul class="deps">${usedBy.map((n) => `<li><a href="#/plugin/${esc(n)}">${esc(n)}</a></li>`).join('')}</ul>` : ''}
          </div>
        </aside>
      </div>
    </div>`;

  if (target) {
    const [t, n] = target.split(':');
    document.getElementById(`c-${t}-${n}`)?.scrollIntoView({ block: 'center' });
  }
}

const isBreaking = (entry) => /\.0\.0$/.test(entry.version) && !entry.version.startsWith('0.') && entry.changes.some((c) => /breaking/i.test(c))
  || entry.changes.some((c) => /^BREAKING/.test(c));

// ---------- Install builder ----------

/** Plugins the user picked plus everything they pull in, with who requires each dependency. */
function resolveStack(picked) {
  const requiredBy = new Map();
  const visit = (name, by) => {
    for (const d of state.plugins.get(name)?.dependencies ?? []) {
      if (picked.has(d.name)) continue;
      if (!requiredBy.has(d.name)) requiredBy.set(d.name, new Set());
      const set = requiredBy.get(d.name);
      if (set.has(by)) continue;
      set.add(by);
      visit(d.name, by);
    }
  };
  for (const name of picked) visit(name, name);
  return requiredBy;
}

function renderStack(params) {
  document.title = 'Install builder — DevDigest Marketplace';
  const shared = params.get('p');
  if (shared !== null) {
    state.stack = new Set(shared.split(',').filter((n) => state.plugins.has(n)));
    saveStack();
    history.replaceState(null, '', hashFor('/stack', { scope: params.get('scope') }));
  }
  const scope = params.get('scope') === 'user' ? 'user' : 'project';
  const picked = [...state.stack].filter((n) => state.plugins.has(n));
  const deps = resolveStack(new Set(picked));
  const flag = scope === 'project' ? ' --scope project' : '';

  const settings = JSON.stringify({
    extraKnownMarketplaces: { [mkt().name]: { source: { source: 'github', repo: mkt().repo } } },
    enabledPlugins: Object.fromEntries(picked.map((n) => [installId(n), true])),
  }, null, 2);
  const commands = [`claude plugin marketplace add ${mkt().repo}${flag}`, ...picked.map((n) => `claude plugin install ${installId(n)}${flag}`)];
  const sessionCommands = [`/plugin marketplace add ${mkt().repo}`, ...picked.map((n) => `/plugin install ${installId(n)}`)];

  const steps = [
    [scope === 'project' ? 'Run in your project root' : 'Run in your shell', '', commands.join('\n')],
    ['Or inside a Claude Code session', '', sessionCommands.join('\n')],
    ...(scope === 'project' ? [['Commit .claude/settings.json', 'The commands above write this file. You can also create it yourself: teammates get the plugins when they trust the folder.', settings]] : []),
    ['Reload', 'Start a new session or run /reload-plugins.', ''],
  ];

  app.innerHTML = `
    <div class="page">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Explore</a> / Install builder</nav>
      <div class="layout">
        <div class="layout__main">
          <div class="page-title">
            <h1>Install builder</h1>
            <p>Pick plugins, choose who gets them, and copy the commands, or a settings file to commit for your team.</p>
          </div>

          <section class="section" aria-labelledby="h-pick">
            <h2 id="h-pick">Pick plugins</h2>
            <div class="pick">
              ${state.catalog.plugins.map((p) => `
                <label>
                  <input type="checkbox" data-pick="${esc(p.name)}" ${state.stack.has(p.name) ? 'checked' : ''}>
                  <span><strong>${esc(p.displayName || p.name)}</strong><small>${plural(p.components.length, 'component')} · v${esc(p.version)}</small></span>
                </label>`).join('')}
            </div>
          </section>

          <section class="section" aria-labelledby="h-install">
            <h2 id="h-install">Install</h2>
            <div class="seg seg--wide" role="group" aria-label="Install scope">
              <button type="button" data-scope="project" aria-pressed="${scope === 'project'}">Project · whole team</button>
              <button type="button" data-scope="user" aria-pressed="${scope === 'user'}">User · just me</button>
            </div>
            ${picked.length ? `
              <ol class="steps">
                ${steps.map(([title, note, code], i) => `
                  <li>
                    <span class="steps__n" aria-hidden="true">${i + 1}</span>
                    <div class="steps__body">
                      <h3>${esc(title)}</h3>
                      ${note ? `<p>${esc(note)}</p>` : ''}
                      ${code ? copyBlock(code) : ''}
                    </div>
                  </li>`).join('')}
              </ol>` : `
              <div class="empty empty--sm">
                <h3>No plugins picked yet</h3>
                <p>Tick plugins above, or use “+” on any card in <a href="#/">Explore</a>.</p>
              </div>`}
          </section>
        </div>

        <aside class="layout__aside">
          <div class="panel">
            <h2>Your stack</h2>
            ${picked.map((n) => stackItem(n)).join('')}
            ${[...deps].map(([n, by]) => stackItem(n, [...by])).join('')}
            ${picked.length ? `<div class="row">
              <button class="btn" type="button" data-share-stack="${scope}">Copy share link</button>
              <button class="btn" type="button" data-clear-stack>Clear</button>
            </div>` : '<p class="muted" style="font-size:13px">Empty</p>'}
          </div>
        </aside>
      </div>
    </div>`;
}

function stackItem(name, requiredBy) {
  const p = state.plugins.get(name);
  const display = p.displayName || name;
  return `
    <div class="stack-item${requiredBy ? ' is-dep' : ''}">
      <div class="grow">
        <strong>${esc(display)}</strong>
        <div class="note">${requiredBy ? `Installed automatically · required by ${esc(requiredBy.join(', '))}` : 'Picked'}</div>
      </div>
      ${requiredBy ? '' : `<button class="icon-btn" type="button" data-stack="${esc(name)}" aria-label="Remove ${esc(display)}">✕</button>`}
    </div>`;
}

// ---------- Releases ----------

function renderReleases(params) {
  document.title = 'Releases — DevDigest Marketplace';
  const only = params.get('plugin') ?? '';
  const entries = state.catalog.plugins
    .filter((p) => !only || p.name === only)
    .flatMap((p) => p.changelog.map((e, i) => ({ p, e, first: i === p.changelog.length - 1 && /first/i.test(e.changes.join(' ')) })))
    .sort((a, b) => b.e.date.localeCompare(a.e.date));

  const months = new Map();
  for (const item of entries) {
    const key = new Date(`${item.e.date}T00:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' });
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(item);
  }

  app.innerHTML = `
    <div class="page releases">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Explore</a> / Releases</nav>
      <div class="releases__head">
        <div class="page-title">
          <h1>Releases</h1>
          <p>Every plugin release, newest first. Users get a release when they update the plugin.</p>
        </div>
        <div class="releases__filter">
          <label for="release-filter">Plugin</label>
          <select class="select" id="release-filter">
            <option value="">All plugins</option>
            ${state.catalog.plugins.map((p) => `<option value="${esc(p.name)}" ${p.name === only ? 'selected' : ''}>${esc(p.displayName || p.name)}</option>`).join('')}
          </select>
          <a class="btn" href="public/feed.xml">Subscribe (Atom)</a>
        </div>
      </div>
      ${[...months].map(([month, items]) => `
        <section class="section">
          <h2 class="month">${esc(month)}</h2>
          <ol class="timeline timeline--feed">
            ${items.map(({ p, e, first }) => `
              <li class="${isBreaking(e) ? 'is-major' : ''}">
                <span class="when">${fmtDate(e.date)}</span>
                <h3>
                  <a href="#/plugin/${esc(p.name)}">${esc(p.displayName || p.name)}</a><code>v${esc(e.version)}</code>
                  ${isBreaking(e) ? '<span class="tag tag--breaking">Breaking</span>' : ''}
                  ${first ? '<span class="tag tag--new">New plugin</span>' : ''}
                </h3>
                <ul>${e.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
                ${e.version === p.version ? codeLine(first ? `claude plugin install ${installId(p.name)}` : `claude plugin update ${installId(p.name)}`) : ''}
              </li>`).join('')}
          </ol>
        </section>`).join('')}
    </div>`;
}

// ---------- Not found ----------

function renderNotFound(message = 'This page does not exist.') {
  document.title = 'Not found — DevDigest Marketplace';
  app.innerHTML = `
    <div class="page">
      <div class="empty">
        <h2>Not found</h2>
        <p>${esc(message)}</p>
        <div class="row"><a class="btn btn--primary" href="#/">Back to Explore</a></div>
      </div>
    </div>`;
}

// ---------- router + events ----------

let lastPath = null;
function route() {
  const { path, params } = parseHash();
  const section = path.startsWith('/plugin/') ? 'explore' : { '/': 'explore', '/stack': 'stack', '/releases': 'releases' }[path];
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }

  document.getElementById('footer').hidden = path !== '/';
  if (path === '/') renderExplore(params);
  else if (path.startsWith('/plugin/')) renderPlugin(decodeURIComponent(path.slice('/plugin/'.length)), params);
  else if (path === '/stack') renderStack(params);
  else if (path === '/releases') renderReleases(params);
  else renderNotFound();

  if (path !== lastPath && !params.get('c')) window.scrollTo(0, 0);
  lastPath = path;
}

let searchTimer;
app.addEventListener('input', (e) => {
  if (e.target.id === 'q') {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => updateExplore({ q: e.target.value, type: null }), 80);
  }
});

app.addEventListener('submit', (e) => e.preventDefault());

app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'release-filter') location.hash = hashFor('/releases', { plugin: t.value });
  if (t.dataset.pick) {
    if (t.checked) state.stack.add(t.dataset.pick);
    else state.stack.delete(t.dataset.pick);
    saveStack();
    route();
  }
});

app.addEventListener('click', (e) => {
  const el = e.target.closest('button, [data-copy]');
  if (!el) return;
  const d = el.dataset;

  if (d.copy !== undefined) return copy(d.copy, d.copyLabel);
  if (d.example !== undefined) {
    const input = document.getElementById('q');
    input.value = d.example;
    input.focus();
    return updateExplore({ q: d.example, type: null });
  }
  if (d.type) return updateExplore({ type: d.type });
  if (d.stack) {
    const name = d.stack;
    if (!state.stack.has(name)) state.stack.add(name);
    else state.stack.delete(name);
    saveStack();
    const { path, params } = parseHash();
    if (path === '/') renderResults(params);
    else route();
    return;
  }
  if (d.installMode) {
    storage((s) => s.setItem('installMode', d.installMode));
    const name = decodeURIComponent(parseHash().path.slice('/plugin/'.length));
    document.getElementById('install').innerHTML = installPanel(state.plugins.get(name), d.installMode);
    return;
  }
  if (d.scope) {
    location.hash = hashFor('/stack', { scope: d.scope === 'user' ? 'user' : null });
    return;
  }
  if (d.shareStack !== undefined) {
    const url = `${location.origin}${location.pathname}${hashFor('/stack', { p: [...state.stack].join(','), scope: d.shareStack === 'user' ? 'user' : null })}`;
    return copy(url, 'Share link copied');
  }
  if (d.clearStack !== undefined) {
    state.stack.clear();
    saveStack();
    route();
  }
});

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (e.key === '/' && !typing) {
    const input = document.getElementById('q');
    e.preventDefault();
    if (input) input.focus();
    else location.hash = '#/';
  }
  if (e.key === 'Escape' && document.activeElement?.id === 'q') {
    document.activeElement.value = '';
    updateExplore({ q: null, type: null });
  }
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  storage((s) => s.setItem('theme', light ? 'light' : 'dark'));
  setThemeLabel();
});
function setThemeLabel() {
  const light = document.documentElement.dataset.theme === 'light';
  document.getElementById('theme-toggle').setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
}

// ---------- boot ----------

async function loadCatalog() {
  for (const [url, sample] of [['public/index.json', false], ['public/index.sample.json', true]]) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) return { catalog: await res.json(), sample };
    } catch { /* try the next source */ }
  }
  throw new Error('No catalog index found');
}

async function boot() {
  setThemeLabel();
  try {
    const { catalog, sample } = await loadCatalog();
    state.catalog = catalog;
    state.isSample = sample;
  } catch {
    app.innerHTML = '<div class="page"><div class="empty"><h2>Catalog unavailable</h2><p>The catalog index could not be loaded. Try again in a minute.</p></div></div>';
    return;
  }
  for (const p of state.catalog.plugins) state.plugins.set(p.name, p);
  for (const p of state.catalog.plugins)
    for (const d of p.dependencies ?? []) {
      if (!state.usedBy.has(d.name)) state.usedBy.set(d.name, []);
      state.usedBy.get(d.name).push(p.name);
    }
  state.docs = buildDocs(state.catalog);
  for (const n of [...state.stack]) if (!state.plugins.has(n)) state.stack.delete(n);
  saveStack();

  document.getElementById('link-contribute').href = repoUrl('/blob/main/CONTRIBUTING.md');
  document.getElementById('link-security').href = repoUrl('/blob/main/docs/SECURITY.md');
  document.getElementById('generated-at').textContent =
    `${state.isSample ? 'Sample data · ' : ''}Catalog updated ${fmtDate(state.catalog.generatedAt.slice(0, 10))}`;

  window.addEventListener('hashchange', route);
  route();
}

boot();
