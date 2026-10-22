import { CopyBlock, useTitle } from '../components/ui';
import { t } from '../i18n';
import { useCatalog } from '../lib/catalog';
import { repoUrl } from '../lib/format';

export function GettingStarted() {
  const { catalog } = useCatalog();
  useTitle(t.gettingStarted.title);
  const repo = catalog.marketplace.repo ?? '<owner>/<repo>';
  const mkt = catalog.marketplace.name;
  const example = catalog.plugins.find((p) => p.dependencies.length)?.name ?? catalog.plugins[0]?.name ?? '<plugin>';
  const minVersion = catalog.plugins
    .map((p) => p.minClaudeCode)
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1);

  const s = t.gettingStarted.steps;
  const steps: [string, string, string][] = [
    [s.add[0], s.add[1], `/plugin marketplace add ${repo}`],
    [s.install[0], s.install[1], `/plugin install ${example}@${mkt}`],
    [s.reload[0], s.reload[1], '/reload-plugins'],
  ];
  const faq = t.gettingStarted.faq;

  return (
    <div className="page">
      <nav className="crumbs" aria-label={t.common.breadcrumb}>
        <a href="#/">{t.common.explore}</a> / {t.gettingStarted.title}
      </nav>
      <div className="layout">
        <div className="layout__main">
          <div className="page-title">
            <h1>{t.gettingStarted.title}</h1>
            <p>{t.gettingStarted.intro}</p>
          </div>

          <section className="section" aria-labelledby="h-install">
            <h2 id="h-install">{t.gettingStarted.forYourself}</h2>
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
            <h2 id="h-team">{t.gettingStarted.forTeam}</h2>
            <p className="muted">
              {t.gettingStarted.teamBefore}
              <code>.claude/settings.json</code>
              {t.gettingStarted.teamAfter}
            </p>
            <CopyBlock text={`claude plugin marketplace add ${repo} --scope project\nclaude plugin install ${example}@${mkt} --scope project`} />
            <p className="hint">
              {t.gettingStarted.severalBefore}
              <a href="#/stack">{t.gettingStarted.severalLink}</a>
              {t.gettingStarted.severalAfter}
            </p>
          </section>

          <section className="section" aria-labelledby="h-update">
            <h2 id="h-update">{t.gettingStarted.update}</h2>
            <p className="muted">{t.gettingStarted.updateText}</p>
            <CopyBlock text={`claude plugin marketplace update ${mkt}\nclaude plugin update ${example}@${mkt}`} />
            <p className="hint">
              {t.gettingStarted.seeBefore}
              <a href="#/whats-new">{t.gettingStarted.seeLink}</a>
              {t.gettingStarted.seeAfter}
            </p>
          </section>

          <section className="section" aria-labelledby="h-trouble">
            <h2 id="h-trouble">{t.gettingStarted.troubleshooting}</h2>
            <dl className="faq">
              <dt>{faq.sshQ}</dt>
              <dd>
                {faq.sshA[0]}
                <code>CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1</code>
                {faq.sshA[1]}
                <code>gh auth login &amp;&amp; gh auth setup-git</code>
                {faq.sshA[2]}
              </dd>
              <dt>{faq.depQ}</dt>
              <dd>
                {faq.depA[0]}
                <code>claude plugin marketplace update {mkt}</code>
                {faq.depA[1]}
              </dd>
              <dt>{faq.reloadQ}</dt>
              <dd>
                {faq.reloadA[0]}
                <code>/reload-plugins</code>
                {faq.reloadA[1]}
                <code>/plugin</code>
                {faq.reloadA[2]}
              </dd>
            </dl>
          </section>
        </div>

        <aside className="layout__aside">
          <div className="panel panel--loose">
            <h2>{t.gettingStarted.requirements}</h2>
            <dl className="kv">
              <dt>{t.gettingStarted.claudeCode}</dt>
              <dd>
                <code>{minVersion ? t.common.minVersion(minVersion) : t.common.any}</code>
              </dd>
              <dt>{t.gettingStarted.marketplace}</dt>
              <dd>
                <code>{mkt}</code>
              </dd>
            </dl>
          </div>
          <div className="panel panel--loose">
            <h2>{t.gettingStarted.more}</h2>
            <a className="panel__link" href={repoUrl(catalog, '/blob/main/docs/RELEASES.md')} target="_blank" rel="noopener noreferrer">
              {t.gettingStarted.releases}
            </a>
            <a className="panel__link" href={repoUrl(catalog, '/blob/main/docs/SECURITY.md')} target="_blank" rel="noopener noreferrer">
              {t.gettingStarted.reviewed}
            </a>
            <a className="panel__link" href={repoUrl(catalog, '/blob/main/CONTRIBUTING.md')} target="_blank" rel="noopener noreferrer">
              {t.gettingStarted.contribute}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
