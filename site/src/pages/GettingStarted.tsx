import { CopyBlock, useTitle } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { repoUrl } from '../lib/format';

export function GettingStarted() {
  const { catalog } = useCatalog();
  useTitle('Getting started');
  const repo = catalog.marketplace.repo ?? '<owner>/<repo>';
  const mkt = catalog.marketplace.name;
  const example = catalog.plugins.find((p) => p.dependencies.length)?.name ?? catalog.plugins[0]?.name ?? '<plugin>';
  const minVersion = catalog.plugins
    .map((p) => p.minClaudeCode)
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1);

  const steps: [string, string, string][] = [
    ['Add the marketplace', 'Inside a Claude Code session. You only do this once per machine.', `/plugin marketplace add ${repo}`],
    ['Install a plugin', 'Dependencies are installed and enabled with it.', `/plugin install ${example}@${mkt}`],
    ['Reload', 'Start a new session, or reload the plugins in the current one.', '/reload-plugins'],
  ];

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/">Explore</a> / Getting started
      </nav>
      <div className="layout">
        <div className="layout__main">
          <div className="page-title">
            <h1>Getting started</h1>
            <p>Plugins are installed with Claude Code itself. This site is for finding them; every command below runs in Claude Code or your shell.</p>
          </div>

          <section className="section" aria-labelledby="h-install">
            <h2 id="h-install">Install for yourself</h2>
            <ol className="steps">
              {steps.map(([title, note, code], i) => (
                <li key={title}>
                  <span className="steps__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="steps__body">
                    <h3>{title}</h3>
                    <p>{note}</p>
                    <CopyBlock text={code} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="section" aria-labelledby="h-team">
            <h2 id="h-team">Install for the whole team</h2>
            <p className="muted">Run once in the project root and commit the <code>.claude/settings.json</code> it writes. Teammates get the plugins when they trust the folder.</p>
            <CopyBlock text={`claude plugin marketplace add ${repo} --scope project\nclaude plugin install ${example}@${mkt} --scope project`} />
            <p className="hint">
              Several plugins at once? Use the <a href="#/stack">install builder</a>.
            </p>
          </section>

          <section className="section" aria-labelledby="h-update">
            <h2 id="h-update">Update</h2>
            <p className="muted">Updating the catalog and updating a plugin are separate steps. Auto-update is off by default; turn it on per marketplace in /plugin → Marketplaces.</p>
            <CopyBlock text={`claude plugin marketplace update ${mkt}\nclaude plugin update ${example}@${mkt}`} />
            <p className="hint">
              See <a href="#/whats-new">What's new</a> for every release.
            </p>
          </section>

          <section className="section" aria-labelledby="h-trouble">
            <h2 id="h-trouble">Troubleshooting</h2>
            <dl className="faq">
              <dt>Install fails with a permission or SSH error</dt>
              <dd>
                Claude Code tries SSH first. Set <code>CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1</code> and store an HTTPS credential (<code>gh auth login &amp;&amp; gh auth setup-git</code>).
              </dd>
              <dt>A dependency is reported as unsatisfied</dt>
              <dd>
                Update the marketplace first (<code>claude plugin marketplace update {mkt}</code>) so the required versions are known, then install again.
              </dd>
              <dt>The plugin installed but nothing changed</dt>
              <dd>
                Start a new session or run <code>/reload-plugins</code>, and check the <code>/plugin</code> Errors tab.
              </dd>
            </dl>
          </section>
        </div>

        <aside className="layout__aside">
          <div className="panel panel--loose">
            <h2>Requirements</h2>
            <dl className="kv">
              <dt>Claude Code</dt>
              <dd>
                <code>{minVersion ? `≥ ${minVersion}` : 'any'}</code>
              </dd>
              <dt>Marketplace</dt>
              <dd>
                <code>{mkt}</code>
              </dd>
            </dl>
          </div>
          <div className="panel panel--loose">
            <h2>More</h2>
            <a className="panel__link" href={repoUrl(catalog, '/blob/main/docs/RELEASES.md')} target="_blank" rel="noopener noreferrer">
              Versions, channels and rollback →
            </a>
            <a className="panel__link" href={repoUrl(catalog, '/blob/main/docs/SECURITY.md')} target="_blank" rel="noopener noreferrer">
              How plugins are reviewed →
            </a>
            <a className="panel__link" href={repoUrl(catalog, '/blob/main/CONTRIBUTING.md')} target="_blank" rel="noopener noreferrer">
              Contribute a plugin →
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
