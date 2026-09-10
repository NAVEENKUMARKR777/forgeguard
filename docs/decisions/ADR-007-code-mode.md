# ADR-007: Code Mode for the multi-tool investigation step, at the smallest real layer

## Status
Accepted

## Context
The proposal's Code Mode idea: instead of the agent calling `get_pull_request`,
`get_service`, `get_pipeline`, and `get_incidents` as four separate steps,
let a sandboxed Worker run a short script that composes all four in one
execution. `@cloudflare/codemode` (v0.5.1) ships three layers, from lightest
to heaviest:

1. **`DynamicWorkerExecutor` + `resolveProvider`** — stateless, runs one
   script once, no framework dependency.
2. **`createCodeTool`** — wraps (1) as a Vercel AI SDK `Tool`, meant to be
   handed to `streamText`/`generateText`'s `tools` option.
3. **`createCodemodeRuntime`** — the full production pattern: durable
   per-agent execution log, replay-on-approval, connectors, snippets. Needs
   the `@cloudflare/codemode/vite` build plugin.

## Decision
Use layer 1 only, in `agents/codemode-investigate.ts`. Layers 2 and 3 both
assume the Vercel AI SDK's tool-calling loop (`generateText`/`streamText`),
but this codebase calls Workers AI directly via `env.AI.run()`
(see ADR-006) — adopting either would mean migrating the whole model-calling
path to the `ai` package, and layer 3 additionally requires switching the
build from plain `wrangler dev`/`deploy` to the Vite plugin. Both are real,
disruptive changes with no payoff for composing four read-only lookups; they
would matter for a much larger tool surface (the exact case Code Mode's docs
target — a GitHub MCP server plus a Stripe spec plus an internal API, where
tool descriptions alone would cost thousands of prompt tokens per request).

`gatherEvidence()` in `agents/release-agent.ts` tries
`investigateViaCodeMode()` first and falls back to four direct calls if it
throws or returns `null` — so Code Mode being unavailable (or, in
production, Worker Loaders requiring account-level enablement) never breaks
the release-analysis flow.

## Consequences
- Verified working: `wrangler dev --local` genuinely spins up the sandboxed
  Worker via `WorkerLoader` and executes the composed script correctly
  (confirmed via a temporary diagnostic log during development, and by the
  resulting risk score matching the direct-call path exactly). This
  surprised us — the `AI` binding needs a live account for anything to work
  locally, but Worker Loaders apparently don't.
- The generated script itself is currently authored by us, not the model —
  `INVESTIGATION_CODE` in `codemode-investigate.ts` is a fixed template with
  `__PR_NUMBER__` substituted in. Letting the model write the investigation
  script (the actual "Code Mode" pitch) is a natural next step once there's
  a second, larger tool surface where letting the model compose calls
  actually beats direct calls — see the "what's real vs. a placeholder"
  table in docs/architecture.md.
- Adopting layer 3 later (durable approval log, connectors) is a real,
  scoped follow-on, not a rewrite: it would replace this file's contents,
  not `agents/release-agent.ts`'s call site.
