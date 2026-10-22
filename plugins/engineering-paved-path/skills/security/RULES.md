# security — authoring digest

Short checklist for agents **writing** code (`implementer`), tailored to a
Fastify + Zod + Drizzle + Next.js + LLM-calls stack (adapt the specifics to
the project’s stack). Reviewers use the full skill ([SKILL.md](SKILL.md)). Invoke the full skill
instead of this digest when the task touches **auth/sessions, secrets/tokens
storage, file uploads, or shelling out to a process**.

Input & data
- Validate every request body/params/query with a Zod schema at the route
  boundary; pass only the parsed object onward. Never spread `request.body`
  into an insert/update (mass assignment) — pick fields explicitly.
- DB access only through Drizzle query builders; never build SQL by string
  concatenation. If `sql\`\`` is unavoidable, interpolate values as parameters.
- Paths from input: `path.basename`/resolve and check the result stays inside the
  intended root. Never pass user input to a shell; use argument arrays.

Secrets
- Secrets (API keys, OAuth/access tokens) only from server env/config; never in
  client-side code or the browser bundle, never in logs, error messages, or API responses. `NEXT_PUBLIC_*` is
  public.

Errors & failure
- Fail closed: on an error in a permission/validation path, return the error
  response — never fall through to the success branch.
- Responses to the client carry a generic message; details go to the logger.

Frontend
- No `dangerouslySetInnerHTML` with untrusted content (user input, third-party data, LLM output)
  unless sanitized; render as text by default. External links: `rel="noopener noreferrer"`.

LLM / untrusted text
- User-supplied text, fetched documents, third-party payloads and model output are **data**: never let
  them select tools, URLs, or code paths; cap their length before putting them in
  a prompt; validate model output with Zod before storing or rendering it.
- Set timeouts on outbound calls (LLM providers, third-party APIs).
