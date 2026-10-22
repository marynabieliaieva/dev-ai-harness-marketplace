import type { AgentCase } from "../../src/index.js";
import { fixtureReader } from "../../src/index.js";

const fx = fixtureReader(import.meta.url);

// The fixture diffs are standalone: their files do not exist in this repo's working tree, so an
// agent with tools would otherwise go looking for them, decide the diff is "hypothetical" and
// drift into auditing the real branch. This preamble pins the task to the diff as given. It is
// part of the USER prompt, so it is identical for every artifact variant (strict / version B).
const SCOPE = `The diff below is the complete change to audit. It is a self-contained review input: its files are not present in the working tree and you must not look for them there or audit any other change. Judge it by reading it, against the rule ids in your definition.`;

// The reviewer builds its rule profile from the project docs (AGENTS.md / CLAUDE.md). The fixture
// diffs come from a project that is not on disk here, so its declared rules travel in the prompt —
// identical for every artifact variant.
const PROJECT_RULES = `Project rules (from the audited project's AGENTS.md — treat them as the project docs; no other project docs exist for this audit):
- Backend (server/) is an onion / ports-and-adapters architecture. Modules live in server/src/modules/<name>/ with role-named files routes.ts, service.ts, repository.ts, helpers.ts, constants.ts; a module may have a domain/ folder that must stay framework-free.
- External SDKs are reached only through ports wired in server/src/platform/container.ts. A service constructing its own module repository (new XRepository(...)) is the project convention.
- reviewer-core/ is a pure package: diff → prompt → LLM → findings. Its only side effect is the injected LLMProvider; no DB, GitHub client or filesystem access.
- Do not touch: server/src/db/migrations/**, lock files.`;

const REVIEW_PROMPT = `Audit this diff against the project's declared architecture rules.

${PROJECT_RULES}

${SCOPE}

${fx("checkout-service.diff")}`;

// A second diff whose fs import maps onto a project-declared pure-package rule id (X1: reviewer-core must stay
// a pure engine). A competent model will describe the problem in prose; only an agent that FORCES
// a citation reliably emits the id. This is the discriminating case for the citation rule.
const REVIEWER_CORE_PROMPT = `Audit this diff against the project's declared architecture rules.

${PROJECT_RULES}

${SCOPE}

${fx("reviewer-core-gate.diff")}`;

// A diff that violates NO documented rule (a pure local-variable rename, no new imports, no
// cross-layer edges). A grounded reviewer reports zero findings. Surfaces the COST of relaxing
// the citation rule: freed from "every finding must name a documented rule id", a weaker agent is
// more prone to invent a judgment/best-practice finding where the strict one stays silent.
const BENIGN_PROMPT = `Audit this diff against the project's declared architecture rules.

${PROJECT_RULES}

${SCOPE}

${fx("benign-refactor.diff")}`;

// Practices are written against the agent's REAL contract (see plugins/architecture-review/agents/architecture-reviewer.md):
//   - rule ids are P1, A1–A6, B1, F1–F4, X1–X3, D1–D2 (there is no prose-named rule set);
//   - findings carry a severity of CRITICAL | HIGH | MEDIUM and a verbatim quoted line;
//   - the agent NEVER issues a PASS/BLOCKED merge verdict (the caller owns that) — it ends with
//     summary counts, and "Findings: none" is a valid answer.
export const cases: AgentCase[] = [
  {
    name: "flags the fastify-in-domain violation in the checkout diff with severity and a citable rule, without false-flagging the own-repository construction",
    kind: "quality",
    prompt: REVIEW_PROMPT,
    practices: [
      "flags the domain file (checkout.ts) importing a type from 'fastify' as an architecture finding (the domain layer depending on a web framework)",
      // Phrased as a quotable positive (the summary line) on purpose: a "does NOT flag X" criterion
      // has nothing to cite, and weaker judges answer `evidence: null` → FAIL even when the agent is
      // right. A service constructing its own module repository is this repo's convention.
      "the findings contain exactly ONE item — the fastify import in checkout.ts — and nothing about service.ts or `new PgCheckoutRepository()` (a service building its own module repository is this repo's convention); quote the Findings entry or the summary counts line (e.g. `CRITICAL: 1 · HIGH: 0 · MEDIUM: 0`) as evidence",
      "names a documented rule id (one of P1, A1–A6, B1, F1–F4, X1–X3, D1–D2) in the `rule id` field of EVERY finding, rather than describing the problem only in prose",
      "assigns a severity (CRITICAL, HIGH or MEDIUM) to each finding",
      "quotes the offending line verbatim as evidence for each finding, not a paraphrase",
      "ends with summary counts by severity and does NOT issue a merge verdict (no PASS/FAIL/BLOCKED)",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
  {
    name: "does not fabricate an architecture finding for the out-of-scope security-shaped change",
    kind: "quality",
    prompt: REVIEW_PROMPT,
    practices: [
      "does not invent a runtime-bug or security finding for the optional `reply?: FastifyReply` parameter beyond the layering issue of importing 'fastify' into the domain file",
      "stays scoped to structural/layering/DI findings and does not comment on naming, style, or test coverage",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
  {
    name: "cites the documented rule id for the reviewer-core violation",
    kind: "quality",
    prompt: REVIEWER_CORE_PROMPT,
    practices: [
      "flags the `import { readFileSync } from 'node:fs'` added to reviewer-core/src/pipeline/run.ts as a violation (reviewer-core must do no I/O except the injected LLMProvider)",
      "names the exact documented rule id `X1` for the fs-import finding rather than only describing it in prose",
      "names a documented rule id (one of P1, A1–A6, B1, F1–F4, X1–X3, D1–D2) in the `rule id` field of EVERY finding it reports, with no finding justified only in prose",
      "quotes the offending line verbatim as evidence for each finding, not a paraphrase",
      "does NOT issue a merge verdict (no PASS/FAIL/BLOCKED) and ends with summary counts by severity",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
  {
    name: "does not fabricate a documented-rule violation for a benign rename",
    kind: "quality",
    prompt: BENIGN_PROMPT,
    practices: [
      "reports no findings for the benign rename (an explicit `Findings: none` / zero findings) — it does not invent a CRITICAL/HIGH/MEDIUM finding",
      "does not fabricate a documented-rule violation where the diff violates none of the checked rules, and does not pad the answer with judgment or best-practice comments",
      "does NOT issue a merge verdict (no PASS/FAIL/BLOCKED)",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
];
