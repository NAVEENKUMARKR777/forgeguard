# ADR-006: Workers AI by default; OpenAI/Anthropic as a real but unverified escape hatch

## Status
Accepted

## Context
Cloudflare's own assignment guidance recommends Workers AI / Llama 3.3 as
the default, which is also the only provider this environment can actually
call (Workers AI needs a Cloudflare account and `wrangler login`, not an API
key). There's a legitimate case for pluggability anyway — a team migrating
onto Workers, or wanting a specific model's behavior, shouldn't have to
rewrite the calling code.

## Decision
`agents/model.ts` exports one function, `generateText(env, messages)`, that
branches on `env.MODEL_PROVIDER` ("workers-ai" by default,
`wrangler.jsonc`'s `vars`). Every call site in the codebase
(`release-agent.ts`, `planner.ts`) goes through this function — none of them
know or care which provider is active. `openai` and `anthropic` are
implemented as plain `fetch` calls against each provider's public REST API
(no SDK dependency), following their documented request/response shapes.

## Consequences
- The `workers-ai` branch is exercised throughout this repo's own testing
  (with the caveat that it needs `wrangler login`/`--remote` to actually
  call the model — see README). The `openai` and `anthropic` branches are
  **not** — there's no API key in this environment to call them with. They
  are implemented against the documented contract, not verified against the
  live APIs.
- Anthropic's Messages API doesn't accept a `system`-role message inside
  `messages` (system prompt is a separate top-level field) — `model.ts`
  handles that reshaping; OpenAI's Chat Completions API accepts the message
  array as-is.
- No secret ever appears in a prompt: `tests/security/secret-leak.test.ts`
  asserts `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` only appear in request
  headers in `model.ts`, never in a `content` field, and don't appear in
  `release-agent.ts`/`planner.ts` at all.
