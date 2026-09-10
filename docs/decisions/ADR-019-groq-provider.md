# ADR-019: Groq as a verified alternative model provider

## Status
Accepted

## Context
ADR-006 added `openai` and `anthropic` branches to `agents/model.ts` as
real-but-unverified escape hatches — implemented against each provider's
documented contract, but never actually called, since this environment has
no API key for either. For local development and demoing without a
Cloudflare account (`workers-ai` needs `wrangler login`), a real, working
alternative provider closes that gap. Groq's Chat Completions API is
OpenAI-compatible and a key was available to test against directly.

Groq deprecated `llama-3.3-70b-versatile` (2026-08-16, per
`console.groq.com/docs/deprecations`) — the same model name Workers AI
serves as `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (`WORKERS_AI_MODEL` in
`agents/model.ts`). The deprecation is Groq-side only; Workers AI's own
Llama 3.3 is unaffected and stays the default. Groq's own documented
replacement is `openai/gpt-oss-120b`.

## Decision
`agents/model.ts` gained a fourth branch, `generateWithGroq()` — structurally
identical to `generateWithOpenAI()` (same request/response shape, Groq's API
being OpenAI-compatible), differing only in base URL
(`https://api.groq.com/openai/v1/chat/completions`), the `GROQ_API_KEY` env
var, and the model (`openai/gpt-oss-120b`, Groq's current recommendation,
not `llama-3.3-70b-versatile`). Set `MODEL_PROVIDER=groq` and `GROQ_API_KEY`
in `.dev.vars` (gitignored, never committed) to use it — no wrangler.jsonc
edit needed, since `.dev.vars` overrides `wrangler.jsonc`'s `vars` for local
dev. `types/env-extra.d.ts` and `tests/security/secret-leak.test.ts`'s
`MODEL_TS_SECRET_ENV_NAMES` both updated for the new secret, matching
`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`'s existing coverage.

## Consequences
- Unlike the `openai`/`anthropic` branches, this one is actually verified:
  a real chat message through a live `wrangler dev --local` instance with a
  real `GROQ_API_KEY` produced real narration text from `openai/gpt-oss-120b`
  — confirmed directly, not assumed from the documented contract alone.
- `workers-ai` remains the default for a deployed instance (unchanged from
  ADR-006) — Groq is a local/demo convenience, not a replacement decision.
- If Groq deprecates `openai/gpt-oss-120b` too, only `GROQ_MODEL` in
  `agents/model.ts` needs to change — same reasoning as ADR-006's original
  provider-swap isolation.
