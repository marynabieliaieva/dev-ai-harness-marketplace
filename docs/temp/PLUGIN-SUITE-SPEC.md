# Специфікація: перший реліз плагінів SDD

Чернетка. Що з [dev-digest-marina](https://github.com/marynabieliaieva/dev-digest-marina)
(`.claude/`, `evals/`) переноситься в маркетплейс, у які плагіни, що треба узагальнити і
як плагіни працюють разом. Після першого релізу зміст переїжджає в README плагінів, а
цей файл видаляється.

## 1. Розкладка компонентів DevDigest на чотири групи

### 1. Повторно використовувані → у плагіни

| Компонент | Плагін | Стан у джерелі |
|---|---|---|
| `agents/spec-creator.md` | `sdd-engineering` | шляхи `specs/`, `Agent(researcher)`, hook у frontmatter — узагальнити (розділ 4) |
| `agents/implementation-planner.md` | `sdd-engineering` | `scripts/check.sh` ×11, `routing.md`, `server/src` — узагальнити |
| `agents/implementer.md` | `sdd-engineering` | `scripts/check.sh`, `routing.md` — узагальнити |
| `agents/plan-verifier.md` | `sdd-engineering` | `scripts/check.sh`, `INSIGHTS.md` — узагальнити |
| `skills/run-plan/` | `sdd-engineering` | `scripts/check.sh`, `arch-check.sh`, прапорці `--review`/`--docs` — узагальнити |
| `skills/workflow-retro/` (+ `ledger-template.md`, `scripts/session-stats.mjs`) | `sdd-engineering` | майже чистий; `docs/retro/` лишається дефолтом |
| `skills/engineering-insights/` | `sdd-engineering` | захардкожені пакети `server/`, `client/`, `reviewer-core/`, `e2e/` — узагальнити |
| `hooks/spec-creator-path-guard.mjs`, `implementation-planner-path-guard.mjs` | `sdd-engineering` | переїжджають у `hooks/hooks.json` плагіна (розділ 4.3) |
| `agents/researcher.md` | `research-tools` | чистий, 0 посилань на DevDigest |
| `agents/architecture-reviewer.md` | `architecture-review` | `server/src`, `client/src`, `arch-check.sh`, `AGENTS.md` — узагальнити |
| усі 12 технічних skills (з `RULES.md`-дайджестами) — див. розділ 8 | `engineering-paved-path` | `onion-architecture` і `frontend-ui-architecture` містять layer-map DevDigest — винести мапу в проєкт; походження й ліцензія кожного — розділ 8 |
| `skills/onion-architecture/evals/` (evals.json + fixtures) | `evals/skills/onion-architecture/skill-creator/` у корені | фікстури не їдуть у кеш плагіна користувача; глибокі шляхи фікстур перевищували Windows MAX_PATH під час тестового встановлення |
| `evals/agents/architecture-reviewer/` (cases + fixtures) | `architecture-review/evals/` | фікстури вигадані (billing, checkout) — переносяться як є |
| `evals/src/` (рушій: vitest + Agent SDK) | `evals/` у корені маркетплейсу (тулінг, не плагін) | читає `.claude/skills` за відносним шляхом — перевести на `plugins/<name>/`; Windows-шляхи ок |

### 2. Project-specific → лишаються в DevDigest

`CLAUDE.md` (корінь, `client/`, `agent-runner/`, `e2e/`), `AGENTS.md`, `INSIGHTS.md`
пакетів, `specs/**`, `docs/plans/**`, `skills/pr-self-review/routing.md` (глоби
`server/src/**`, `client/src/**`), `scripts/check.sh`, `scripts/arch-check.sh`,
layer-map з `onion-architecture`. Плагіни отримують до них доступ лише через
конвенції проєкту-споживача (розділ 4.1).

### 3. Optional integrations → не в першому релізі

`evals/proxy/` (LiteLLM, docker-compose) і бекенд OpenRouter (`run-openrouter.ts`): мережа
і ключі. Якщо колись знадобиться, то окремим плагіном за [SECURITY.md](../SECURITY.md).

### 4. Локальні залишки → не переносимо

`.claude/settings.json`, `.claude/launch.json`, `.claude/tmp/`,
`evals/skill-creator-workspaces/`, експерименти `architecture-reviewer-lite`,
`dependency-checker-lite`.

### Поза першим релізом (переносиме, але не SDD-ядро)

`test-writer` (на паузі в джерелі), `doc-writer`, `pr-self-review`, `dependency-checker`.
Кандидати в наступні релізи; `run-plan` у v0.1 обходиться без них (розділ 3).

## 2. Плагіни і залежності

| Плагін | Компоненти | Залежить від |
|---|---|---|
| `engineering-paved-path` | усі 12 технічних skills, skill `skill-routing` | — |
| `research-tools` | агент `researcher` | — |
| `architecture-review` | агент `architecture-reviewer`, evals | `engineering-paved-path` |
| `sdd-engineering` | агенти `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`; skills `run-plan`, `workflow-retro`, `engineering-insights`; hooks; evals | усі три вище |

```text
sdd-engineering ──► research-tools
       │        ──► architecture-review ──► engineering-paved-path
       └──────────────────────────────────► engineering-paved-path
```

Посилання між плагінами — лише через неймспейс: `Agent(research-tools:researcher)`,
`architecture-review:architecture-reviewer`, `engineering-paved-path:security`.
Технічні skills не копіюються в агентів: у кожного одне джерело в
`engineering-paved-path`.

## 3. Як `sdd-engineering` працює разом (основа README)

```text
researcher (ad hoc, будь-коли)

1. вручну  spec-creator            → specs/<slug>/spec.md       → користувач: Status: approved
2. вручну  implementation-planner  → docs/plans/<slug>.md        (відмовляє без approved spec)
3. /sdd-engineering:run-plan docs/plans/<slug>.md [--spec] [--designs …] [вимоги…]
     0 preflight: хвилі з DAG, класифікація додаткових вимог
     1 implementer ∥ … по хвилі        (точкова перевірка з плану, ≤3 цикли фіксу)
     2 plan-verifier (усі задачі) ⟲ fix (≤2 раунди)
     3 architecture-reviewer ⟲ fix ⟲ re-review (≤3 раунди) → 3b plan-verifier по зачеплених задачах
     4 фінальна перевірка з плану один раз ⟲ fix
4. /sdd-engineering:workflow-retro [label] [--deep]  → docs/retro/ledger/   (лише вручну)
```

- `run-plan` і `workflow-retro` мають `disable-model-invocation: true`: запускає їх лише
  користувач.
- `--review` (`pr-self-review`) і `--docs` (`doc-writer`) у v0.1 прибираються. Коли ці
  плагіни з'являться, прапорці повернуться і працюватимуть, лише якщо плагін встановлено.
- `engineering-insights` — фінальний крок `implementer`/retro, а не крок для кожного файла.

## 4. Що треба узагальнити (контракт плагін ↔ проєкт)

### 4.1 Конвенції проєкту-споживача

| Що було в DevDigest | Що стає в плагіні |
|---|---|
| `scripts/check.sh <pkg> <files>` | Планер визначає команди test/lint/typecheck проєкту і пише точну команду в Done-condition кожної задачі; implementer і verifier виконують саме її. Механізм fingerprint лишається |
| `scripts/arch-check.sh` | Необов'язковий: якщо в проєкті є arch-check, reviewer його запускає; інакше судить за skills |
| `architecture-reviewer`, прив'язаний до onion/frontend DevDigest | Узагальнений: межі беруться з правил проєкту (`CLAUDE.md`/`AGENTS.md`: шари, пакети, «Do not touch»). `onion-architecture` і `frontend-ui-architecture` застосовуються, лише якщо проєкт їх оголосив. Без правил — перевіряє тільки напрямок залежностей між пакетами й повідомляє, що правил немає |
| `pr-self-review/routing.md` | Skill `engineering-paved-path:skill-routing` описує механізм; мапа «глоб → skill» лежить у проєкті (`.claude/skill-routing.md`). Якщо мапи немає, агенти користуються автовибором skills |
| `INSIGHTS.md` у фіксованих пакетах | `INSIGHTS.md` у корені пакета, якого торкалася сесія (найближчий `package.json`/корінь репо) |
| layer-map в `onion-architecture` | Загальні правила лишаються в skill, мапа шарів проєкту — у його `CLAUDE.md`/`AGENTS.md` |
| `specs/<slug>/`, `docs/plans/<slug>.md`, `docs/retro/ledger/` | Залишаються дефолтними шляхами |

### 4.2 Агенти, які викликають агентів

`spec-creator` і `implementation-planner` мають `Agent(researcher)`. Субагент не може
запускати субагентів, тож це працює, лише коли агент — головний потік сесії. README
описує запуск `claude --agent sdd-engineering:spec-creator` (перевірити, що `--agent`
приймає агентів плагіна). Якщо агента викликано як субагента, він робить одну власну
перевірку по коду й повертає питання пакетом, як уже робить планер.

### 4.3 Path-guard hooks

Агенти плагіна не підтримують `hooks`, `mcpServers` і `permissionMode` у frontmatter.
Тому guards переїжджають у `sdd-engineering/hooks/hooks.json` (`PreToolUse`,
`Edit|Write|NotebookEdit`). Скрипт у `scripts/` фільтрує за `agent_type` з вхідних даних
hook і пропускає все, що не `sdd-engineering:spec-creator`/`implementation-planner`.
Перевірити: чи передається `agent_type` у PreToolUse для субагентів у мінімальній
підтримуваній версії Claude Code, і як hook поводиться, коли агент — головний потік.

## 5. Структура `sdd-engineering`

```text
plugins/sdd-engineering/
├── .claude-plugin/plugin.json      # dependencies: research-tools, architecture-review, engineering-paved-path
├── agents/{spec-creator,implementation-planner,implementer,plan-verifier}.md
├── skills/
│   ├── run-plan/SKILL.md
│   ├── workflow-retro/{SKILL.md,ledger-template.md,scripts/session-stats.mjs}
│   └── engineering-insights/SKILL.md
├── hooks/hooks.json
├── scripts/{spec-path-guard,plan-path-guard}.mjs
├── evals/                          # behavior evals (розділ 6)
├── README.md                       # розділи 3 і 4.1 + таблиця агентів з джерела
├── CHANGELOG.md                    # версії та релізи
└── COMPATIBILITY.md                # мін. Claude Code + сумісні діапазони залежностей
```

`research-tools`, `architecture-review` і `engineering-paved-path` мають ту саму
обов'язкову трійку `README.md`, `CHANGELOG.md`, `COMPATIBILITY.md`.

## 6. Behavior evals

У джерелі є evals лише для `architecture-reviewer` і `pr-self-review`; для SDD-агентів їх
треба написати. Мінімум для v0.1:

| Сценарій | Перевіряє |
|---|---|
| `implementation-planner` + spec без `Status: approved` | відмовляє |
| `spec-creator` пише поза `specs/<slug>/` | hook блокує запис |
| `implementer` + задача з owned paths | не редагує файли поза ними, не чіпає тести, щоб «позеленити» |
| `plan-verifier` + свідомо недороблений AC | ставить NOT MET з `file:line` |
| `run-plan` без аргументу | питає план, не вигадує |
| `workflow-retro` під час незавершеного прогону | зупиняється |

Дві системи, бо `plugins/<name>/evals/` — тека за замовчуванням офіційного
`claude plugin eval` (Claude Code 2.1.269+):

- **behavior-кейси плагінів** — у форматі `claude plugin eval` (`prompt.md` +
  `graders/*.md`, фікстури через `case.yaml` + `scaffold.sh`) у `plugins/<name>/evals/`;
- **рушій DevDigest** (`evals/src`, vitest + Agent SDK) — у корені маркетплейсу як
  тулінг, з кейсами в `evals/{skills,agents}/<name>/`; шукає артефакти в `plugins/*/`.
Бекенд OpenRouter і LiteLLM-proxy не переносяться (група 3). CI запускає статичний tier
на кожен PR, LLM-tier — вручну (`workflow_dispatch`), бо він іде на підписці.

## 7. Версії та релізи

- Перший реліз усіх чотирьох — `0.1.0`; `1.0.0` — коли формати `spec.md`/плану
  стабілізуються.
- Ламаюча зміна формату артефакта (напр. нумерація AC чи формат Done-condition) — MAJOR
  у плагіні, що його пише, і в усіх, що читають.
- Порядок: `engineering-paved-path`, `research-tools` → `architecture-review` →
  `sdd-engineering`; можна одним PR, `release-tags.yml` тегує залежності першими.

## 8. Походження технічних skills

Звірено 2026-10-21 (`diff` `SKILL.md` з першоджерелом). `dev-digest-marina` — форк
курсового шаблону [ai-agentic-engineering-neo/dev-digest](https://github.com/ai-agentic-engineering-neo/dev-digest),
з якого прийшли 10 із 12 skills. Усі 12 переносяться в `engineering-paved-path` 1.0.0.

| Skill | Першоджерело | Ліцензія |
|---|---|---|
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) `skills/fastify` | MIT, © 2026 Matteo Collina |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) `plugins/database-design/skills/postgresql` @ `7b7d968` | MIT, © 2024 Seth Hobson |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) `plugins/developer-kit-typescript/skills/drizzle-orm-patterns` | MIT, © 2025 Giuseppe Trisciuoglio |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) `skills/.curated/zod` | MIT, © 2025 pproenca |
| `typescript-expert` | [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) `skills/typescript-expert` (змінено, 18 рядків) | MIT, © 2026 Antigravity User |
| `security`, `mermaid-diagram` | курсовий шаблон | MIT (шаблон) |
| `react-best-practices`, `react-testing-library` | [burnjohn/ai-demo-marketplace](https://github.com/burnjohn/ai-demo-marketplace) | не вказана |
| `next-best-practices` | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) @ `dc1de9c` (skills переїхали в `vercel/next.js`) | не вказана |
| `onion-architecture`, `frontend-ui-architecture` | власні | MIT маркетплейсу |

Ліцензійну перевірку не проводимо (рішення власника). Мінімум, який лишається:
для MIT-skills у теці лежить `LICENSE` першоджерела (цього вимагає сама MIT), а
`engineering-paved-path/README.md` має розділ «Credits» з цією таблицею.

## 9. Перевірка (критерій готовності)

Для кожного файла в `plugins/` можна назвати його **owner** (плагін), **consumer
scenario** (рядок з розділу 3 чи 6) і **причину, чому він оновлюється разом із
рештою плагіна**. Файл, для якого цього не можна сказати, не переноситься. Плюс:
`grep -ri "devdigest\|server/src\|client/src\|scripts/check.sh" plugins/` нічого не
знаходить.

## Рішення

| Питання | Рішення (2026-10-21) |
|---|---|
| Ліцензії технічних skills | Не перевіряємо; переносимо всі, з `LICENSE` для MIT-skills і Credits у README (розділ 8) |
| Обсяг `engineering-paved-path` | Усі 12 skills у 0.1.0 |
| `architecture-reviewer` | Узагальнити: межі з правил проєкту, onion/frontend — лише якщо проєкт їх оголосив (розділ 4.1) |
| Рушій evals | Переноситься в маркетплейс (`evals/` у корені) зі своїми кейсами; behavior-кейси плагінів — у форматі `claude plugin eval`; OpenRouter/LiteLLM — ні (розділ 6) |
