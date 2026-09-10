# Architecture decisions

Full records live in [`decisions/`](decisions/); this is just the index, in
the order they were made.

| ADR | Decision |
|---|---|
| [001](decisions/ADR-001-agent-runtime.md) | Agent runtime: Cloudflare Agents SDK on a SQLite-backed Durable Object |
| [002](decisions/ADR-002-mcp-vs-direct-tools.md) | Fixture-backed tool modules for the chat path, instead of a live GitHub/CI integration |
| [003](decisions/ADR-003-policy-vs-llm.md) | The model narrates; deterministic code decides — never the reverse |
| [004](decisions/ADR-004-durable-workflow.md) | Cloudflare Workflows for the release process, separate from the chat Durable Object |
| [005](decisions/ADR-005-shared-memory.md) | Shared engineering memory as its own Durable Object, and a real MCP server on top of it |
| [006](decisions/ADR-006-model-providers.md) | Workers AI by default; OpenAI/Anthropic as a real but unverified escape hatch |
| [007](decisions/ADR-007-code-mode.md) | Code Mode for the multi-tool investigation step, at the smallest real layer |
| [008](decisions/ADR-008-react-dashboard.md) | React + Vite dashboard, superseding the earlier vanilla-JS choice |
| [009](decisions/ADR-009-gitops.md) | GitOps drift as a bounded 7th risk dimension, not a rescoring |
| [010](decisions/ADR-010-audit-and-idempotency.md) | Structured audit trail + workflow idempotency keys |
| [011](decisions/ADR-011-mcp-tool-expansion.md) | Full GitHub/CI tool surface + a declared tool metadata registry |
| [012](decisions/ADR-012-productivity-metrics.md) | Developer productivity metrics as real aggregation over generated data |
| [013](decisions/ADR-013-eval-expansion.md) | Incident and remediation evals, by extracting the logic they test |
| [014](decisions/ADR-014-observability.md) | Structured observability events over scattered console.log |
| [015](decisions/ADR-015-eval-history.md) | D1 for eval run history, over KV or committed JSON artifacts |
| [016](decisions/ADR-016-e2e-suite.md) | Checked-in Playwright smoke suite, separate from `npm test` |
| [017](decisions/ADR-017-productivity-route-collision.md) | `/productivity` sub-paths only — bare path is always the SPA |
| [018](decisions/ADR-018-dev-server-local-mode.md) | `wrangler dev --local` for `npm run dev`/`dev:worker-only` |
| [019](decisions/ADR-019-groq-provider.md) | Groq as a verified alternative model provider |
| [020](decisions/ADR-020-stale-reuse-detection.md) | Detecting a false-negative `reused` flag in chat, not just in tests |
| [021](decisions/ADR-021-demo-target-repo.md) | A separate demo target repo (`forgeguard-demo`), so using ForgeGuard never changes ForgeGuard |
