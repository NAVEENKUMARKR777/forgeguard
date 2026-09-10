# Architecture

Cross-cutting systems not drawn below to keep this diagram readable:
`productivity/` (its own `/productivity` route and API, no agent
involvement), `audit/` and `observability/` (wrap the calls already shown,
not separate request paths), and `evals/history-api.ts` (D1-backed, served
from `/evals/runs` and `/evals/compare`, see ADR-015). Each has its own
section below or in the README's Capabilities list. `gitops/` *is* drawn
below — it's a real risk-scoring input, not just instrumentation.

```
     apps/dashboard/ — React + Vite SPA (chat, evals, productivity routes)
     built to apps/dashboard/dist/, served as static assets
                          │
                   WebSocket (JSON)         GET /eval-results.json
                          │                          │
        src/worker.ts ───┼── /mcp → mcp/server.ts (real MCP protocol server)
              │           │                          │
     routeAgentRequest    │                  durable-objects/
              ▼           │                  engineering-memory.ts
  agents/session-agent.ts │                  (shared incident +
  (SessionAgent DO,       │                   "remembered" facts —
   WebSocket + state)     │                   one instance, id "global")
              │           │                          ▲
              ▼           │                          │
     agents/planner.ts ───┴──────────────────────────┘
     (classifyIntent → dispatch)
              │
      ┌───────┴────────┐
      ▼                ▼
  release-agent.ts   incident-agent.ts
      │                │
      │                └─→ workflows/incident-workflow.ts
      │                    (gather-signals → correlate → [approve] → rollback)
      │
      ├─→ agents/codemode-investigate.ts (Code Mode: sandboxed
      │    multi-tool investigation via Worker Loader; falls back
      │    to direct mcp/github.ts + mcp/cicd.ts calls)
      ├─→ gitops/state.ts + gitops/drift.ts (desired vs. deployed vs.
      │    CI commit — ADR-009; feeds risk/engine.ts as its 7th dimension,
      │    fetched as its own step, independent of the evidence above)
      ├─→ risk/engine.ts + policy/engine.ts (deterministic, no LLM)
      ├─→ agents/model.ts → env.AI.run() / OpenAI / Anthropic
      │    (narrates the already-computed risk/policy — ADR-003)
      └─→ workflows/release-workflow.ts
           (gather-evidence → assess-risk → evaluate-policy → [approve])
                    │ on approval
                    ▼
           workflows/remediation-workflow.ts
           (deploy-canary → wait-for-canary → check-health → promote → verify)
```

## Request paths

- `GET /`, `/evals`, `/productivity`, `/eval-results.json` → served from
  `apps/dashboard/dist/` (built by `npm run build:dashboard`) via the
  Workers Assets binding, with `not_found_handling: single-page-application`
  so React Router's client-side routes resolve correctly on a direct load
  or refresh.
- `POST /mcp` → `mcp/server.ts`, a real MCP JSON-RPC server (not routed
  through the Agent at all — any MCP client can reach it directly).
- `GET /productivity/overview`, `/productivity/metrics`,
  `/productivity/services/:service` → `productivity/api.ts`. Deliberately
  never bare `/productivity` — see ADR-017 for why that path is reserved
  for the SPA and the routing bug this fixed.
- `GET /evals/runs`, `GET /evals/compare` → `evals/history-api.ts`, D1-backed
  (ADR-015); bare `/evals` itself is the React page, handled by the Assets
  fallback above, not this route.
- `GET/Upgrade /agents/session-agent/:name` → routed by `routeAgentRequest`
  to the named `SessionAgent` Durable Object. `:name` is a random id the
  dashboard generates once per browser and keeps in `localStorage`, so a
  reload returns to the same session.

## The dashboard

`apps/dashboard/` is a React 19 + Vite + Tailwind v4 single-page app —
`npm run dev` runs it via Vite's dev server (HMR, proxying `/agents` and
`/mcp` to `wrangler dev` — see `apps/dashboard/vite.config.ts`) and
`npm run build:dashboard` produces the static bundle Workers actually
serves. `useAgentSocket` (`src/hooks/useAgentSocket.ts`) owns the
WebSocket: it applies `SessionState` from `cf_agent_state`/`state` messages
(persistent — risk, policy, pending approval) and tracks `pipeline_step`
messages as separate, deliberately ephemeral local state (reset on every
new outbound message, not stored server-side). The risk gauge, per-component
breakdown, policy card, live pipeline timeline, and approval controls are
all driven directly off that state — nothing is duplicated or re-derived.

## The pipeline for "Is PR #1842 safe to deploy?"

1. `classifyIntent()` (`agents/intent.ts`) — deterministic keyword match,
   not an LLM call (ADR-002/ADR-003).
2. `agents/planner.ts` dispatches to `release-agent.analyzeRelease()`.
3. `gatherEvidence()` tries `investigateViaCodeMode()` first (a sandboxed
   Worker composing four tool calls — ADR-007), falling back to direct
   `mcp/github.ts` / `mcp/cicd.ts` / `EngineeringMemoryStore` calls; a
   separate `fetch-gitops` step then runs `gitops/state.ts` +
   `gitops/drift.ts` (ADR-009).
4. `assessRisk()` — deterministic 0–100 score across seven components
   (incl. GitOps drift).
5. `evaluatePolicy()` — reads `policy/policies.yaml`, decides
   `approvalRequired`, independent of the model.
6. `agents/model.ts#generateText()` narrates the result through a
   token-budgeted context (`context/builder.ts`). The model never
   recomputes the score.

Each stage emits a `pipeline_step` WebSocket message so the dashboard shows
live progress.

## Approving a release

`release-agent.startWorkflow()` creates a `ReleaseWorkflow` instance. If
policy requires approval, the workflow parks on `step.waitForEvent()`; the
agent tracks this in `SessionState.pendingApproval` (not on the
PR-specific `activeInvestigation`, since an incident report can also need
approval without any PR having been analyzed). Saying "approve" calls
`instance.sendEvent(...)`, which resumes the workflow; on completion,
`release-agent.ts` automatically starts `RemediationWorkflow` to simulate
the actual rollout.

## What's real vs. what's a stand-in

| Piece | Status |
|---|---|
| Durable Object session state, WebSocket chat | Real |
| Risk scoring, policy engine, all evals | Real, deterministic, tested |
| Shared incident/engineering memory (Durable Object) | Real, verified cross-session and cross-protocol (chat ↔ MCP) |
| Real MCP server at `/mcp` (JSON-RPC, tools/list, tools/call) | Real, verified with raw protocol requests |
| Cloudflare Workflows (release, incident, remediation) with human approval | Real, verified end-to-end including `waitForEvent`/`sendEvent` |
| Code Mode sandboxed investigation | Real, verified working in local dev (see ADR-007) |
| GitOps drift detection | Real, deterministic (`gitops/`), 7th risk dimension (ADR-009) |
| Developer productivity metrics | Real aggregation (`productivity/`) over generated, `source: "fixture"`-labeled data (ADR-012) |
| Audit trail | Real, request/session/workflow-correlated, auto-redacting (`audit/`, ADR-010) |
| Observability | Real structured JSON events wired into LLM/tool/context calls (`observability/`, ADR-014) |
| Eval run history / comparison | Real, D1-backed (`evals/history-api.ts`), not an in-memory array (ADR-015) |
| Llama 3.3 explanation (Workers AI) | Real; needs a Cloudflare account to actually call (see README) |
| OpenAI / Anthropic model providers | Implemented against each API's documented contract; unverified — no API key in this environment |
| Cloudflare API adapter (worker/zone data) | Implemented against the documented API; unverified — no account token here; not wired into the default chat path |
| React dashboard (chat + evals + productivity) | Real, verified with a checked-in browser suite (`npm run test:e2e`, Playwright, ADR-016): WebSocket connect, full analyze → workflow → approve → remediation cycle, the incident flow, and the evals/productivity pages, all with zero console errors |
| Voice input | Real (Web Speech API, browser-native); not exercised by the Playwright suite above since it needs a real microphone |
| GitHub / CI data | Fixture-backed, not a live integration (ADR-002) |
| `createCodemodeRuntime`'s durable approval log, connectors | Not implemented — would need adopting Vite + the Vercel AI SDK (ADR-007) |
