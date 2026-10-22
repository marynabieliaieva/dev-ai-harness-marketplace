# Compatibility

## Claude Code

Minimum: **>=2.1.110** — the version this marketplace requires for version-constrained
plugin dependencies (`"dependencies": [{ "name": …, "version": "^1.0.0" }]`).

Newer features, listed separately:

| Feature | Since | Needed for |
|---|---|---|
| `agent_id` / `agent_type` in hook input | before 2.1.110 | path guard (covered by the minimum) |
| `claude plugin eval` | 2.1.269 | running the behavior evals in `evals/` — development only, not at runtime |

Known fixes worth having: plugin dependency version pins with a marketplace added as a
local git folder are honored from 2.1.196 (matters when testing this repository locally).

## Dependencies

| sdd-engineering | research-tools | architecture-review | engineering-paved-path |
|---|---|---|---|
| 1.x | ^1.0.0 | ^1.0.0 | ^1.0.0 |

Artifact formats this version reads and writes: spec header `# Spec: … | Spec ID: SPEC-NN |
Status: …` with `AC-n` IDs; plan format with `Context → Check commands`. A change to either
format is a MAJOR release of this plugin.

## Runtime

Node.js 18+ on `PATH` for the path-guard hook and the `workflow-retro --deep` parser.
