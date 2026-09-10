# ADR-014: Structured observability events over scattered console.log

## Status
Accepted

## Context
The codebase already had ad-hoc `console.warn`/`console.log` calls at a few
interesting points (Code Mode fallback, idempotency collisions). Cloudflare
Workers ships whatever a Worker logs to `observability` (already `enabled`
in `wrangler.jsonc`) to the dashboard, but an unstructured log line can't be
filtered or aggregated by event type there.

## Decision
`observability/events.ts` declares a small closed set of event types
(`llm.call`, `tool.call`, `mcp.call`, `workflow.step`, `policy.decision`,
`context.assembled`). `observability/logger.ts#emit()` writes one JSON line
per event; `withObservability()` wraps an async operation and always emits
exactly one event with `durationMs` and `success`, on both the happy and
error path. Wired into the three highest-value spots: `agents/model.ts`
(every LLM call, any provider — latency and approximate prompt size),
`mcp/server.ts` (every tool call, via a `traced()` wrapper so each of the 9
handlers didn't need editing by hand), and `context/builder.ts` (every
context assembly — included/dropped counts and final token estimate).

## Consequences
- Verified live against `wrangler dev`: a `tools/call` request produces a
  `tool.call` line with the tool name and duration; a chat message
  produces a `context.assembled` line (10 sources, 420 estimated tokens)
  followed by an `llm.call` line that correctly reports `success: false`
  when Workers AI isn't reachable (no account in this environment) — the
  same graceful-degradation path already covered by ADR-002/ADR-006 now
  also emits a structured, filterable record of *why* it degraded.
- This is intentionally not full distributed tracing (no span IDs linking
  a `context.assembled` event to the `llm.call` that consumed it beyond
  both happening in the same request) — `audit/types.ts`'s `requestId`
  already exists for that correlation on the audit-trail side; wiring the
  same `requestId` through observability events is a natural next step,
  not done here to keep this change additive rather than touching every
  call site's signature twice.
