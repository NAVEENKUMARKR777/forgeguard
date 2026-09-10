# ForgeGuard

AI release and incident commander, built on Cloudflare Workers, the Agents
SDK, Workflows, Workers AI, Code Mode, and the Model Context Protocol.

**Live deployment:** <https://forgeguard.forgeguard.workers.dev>

## Why it exists

Given a pull request, ForgeGuard investigates it — evidence, CI, GitOps
drift, prior incidents — computes a deterministic risk score and policy
decision, explains the result in plain language, and, if policy requires
it, runs a durable Cloudflare Workflow that pauses for human approval
before "deploying." It investigates live incident reports against the same
evidence, remembers facts across sessions, tracks developer-productivity
metrics, and exposes the same data to any MCP client — not a chatbot that
talks about deployments, but a control plane with the model in an advisory
seat.

## The core design principle

**The model narrates; deterministic systems decide.** Risk scoring
(`risk/engine.ts`) and policy enforcement (`policy/engine.ts`) are pure
functions with zero model calls in them. `tests/security/` proves, from the
actual source — not from a comment claiming it — that no narration path can
reach the functions that approve a deployment or resume a paused workflow,
that a PR title worded like a system instruction cannot change a policy
decision, and that "approve" always targets the session's own pending
workflow, never one named in user text. See
[`ADR-003`](docs/decisions/ADR-003-policy-vs-llm.md).

```
                 ┌─────────────────────┐
                 │        LLM          │
                 │ explains / proposes │
                 └──────────┬──────────┘
                             │
                             ▼
                    ┌───────────────┐
                    │ Evidence / MCP│
                    └───────┬───────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       Deterministic Risk          Deterministic Policy
       (incl. GitOps drift)      (allow / require approval)
              │                             │
              └──────────────┬──────────────┘
                             ▼
                   Durable Workflow
                (waitForEvent / sendEvent)
                             │
                             ▼
                   Human Authorization
                             │
                             ▼
                   Execute + Verify
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
               Audit                 Memory
        (requestId-correlated)  (cross-session, MCP-visible)
```

Full system diagram: [`docs/architecture.md`](docs/architecture.md).

## Capabilities

- **Release analysis** — `agents/release-agent.ts` gathers PR/CI/GitOps
  evidence (via Code Mode when available, direct calls otherwise), scores
  risk across 7 deterministic dimensions, evaluates policy, and narrates
  the result.
- **Release workflow** — `workflows/release-workflow.ts`: gather-evidence →
  assess-risk → evaluate-policy → (`waitForEvent`) → approved/rejected.
  On approval, `RemediationWorkflow` automatically simulates the
  canary → check-health → promote → verify rollout.
- **Incident investigation** — `agents/incident-agent.ts` +
  `workflows/incident-workflow.ts`: correlates a symptom against
  engineering memory and GitOps drift into a confidence-scored root-cause
  hypothesis (`incident/correlate.ts`), pausing for rollback approval on
  high-criticality services.
- **MCP server** — `mcp/server.ts` at `/mcp`, real JSON-RPC, 9 read-only
  tools spanning GitHub-shaped (`get_pull_request`, `get_reviews`,
  `get_commits`, `get_diff`, `search_code`, ...) and CI/CD-shaped
  (`get_checks`, `get_deployment`, ...) data, each declared in
  `mcp/tool-metadata.ts` with access/approval/risk metadata.
- **GitOps drift detection** — `gitops/`: desired vs. deployed vs.
  CI-validated commit, resolving to `in_sync | deployment_behind |
  deployment_ahead | reconciliation_failed | unknown` — never an
  optimistic guess when evidence is missing.
- **Cross-session memory** — `durable-objects/engineering-memory.ts`: a
  shared Durable Object for incident history and "remembered" facts,
  visible to every chat session and to any MCP client.
- **Policy-as-code** — `policy/policies.yaml`, human-editable, enforced by
  `policy/engine.ts`.
- **Code Mode** — `agents/codemode-investigate.ts`: the multi-tool
  investigation runs inside a sandboxed Worker (`DynamicWorkerExecutor`,
  no network access), with a direct-call fallback.
- **Context engineering** — `context/{ranking,budget,sources}.ts`: ranked,
  deduplicated, token-budgeted context assembly — nothing reaches the model
  it doesn't need.
- **Evaluation** — `evals/`: 7 suites (risk, tool-selection, policy,
  memory, incident, remediation, regression), 23 cases, rendered at
  `/evals` from a real run, never hand-typed numbers. Run history and
  run-over-run comparison are D1-backed, not an in-memory array — see
  [`ADR-015`](docs/decisions/ADR-015-eval-history.md).
- **Developer productivity** — `productivity/`: PR cycle time, CI/deploy
  reliability, AI-investigation volume, MTTR — real aggregation over
  generated (clearly `source: "fixture"`-labeled) daily data, rendered at
  `/productivity`.
- **Audit trail** — `audit/`: every action correlated by `requestId`,
  `sessionId`, and `workflowId`, with automatic secret redaction.
- **Observability** — `observability/`: structured JSON events for every
  LLM call, tool call, and context assembly.
- **Security** — `tests/security/`: 10 test files, see
  [`docs/threat-model.md`](docs/threat-model.md).
- **Dashboard** — React 19 + Vite + Tailwind v4, 3 routes (chat, evals,
  productivity), voice input via the Web Speech API.

## Running it

```
npm install
npm run dev
```

This runs `wrangler dev` (the Worker) and `vite dev` (the dashboard, with
HMR) together — open the **Vite URL** it prints (typically
`http://localhost:5173`), not the wrangler one; Vite proxies `/agents` and
`/mcp` through to the Worker (see `apps/dashboard/vite.config.ts`). Try
`Is PR #1842 safe to deploy?`, then walk through
[`docs/demo.md`](docs/demo.md) for the full tour.

To run just the built Worker (no dashboard hot-reload — useful for
checking exactly what will actually deploy): `npm run dev:worker-only`.

**Everything works with no external credentials** except the model's
plain-language narration (Workers AI isn't locally simulated — run
`wrangler login` first, or `wrangler dev --remote`; without it, the agent
falls back to a short generated message rather than crashing). Risk
scoring, policy, GitOps, memory, workflows/approval, Code Mode, the MCP
server, and the productivity/eval dashboards all run fully local.

```
npm run typecheck   # regenerates worker-configuration.d.ts (wrangler types), then
                     # checks three tsconfigs: Workers runtime, Node tooling, dashboard
npm run test        # vitest — pure engine unit tests + tests/security/*
npm run evals       # risk, tool-selection, policy, memory, incident, remediation, regression
npm run evals:record # records a run to D1 and prints the comparison against the previous one
npm run verify:mcp  # spins up wrangler dev, speaks real JSON-RPC to /mcp
npm run test:e2e    # Playwright — full analyze/workflow/approval/incident/evals/productivity paths
npm run build       # wait — see below
```

`test:e2e` is intentionally separate from `npm test`: a browser plus a live
`wrangler dev` instance is a heavier dependency than the rest of the suite
needs — see [`ADR-016`](docs/decisions/ADR-016-e2e-suite.md).

(There's no single `npm run build`; `npm run build:dashboard` builds the
SPA, and `wrangler deploy`/`predeploy` runs it automatically.)

Open `/evals` or `/productivity` after `npm run dev` to see live-rendered
results — real numbers from real code, not mockups.

## Live integrations

The OpenAI/Anthropic model providers (`agents/model.ts`) and the
Cloudflare API adapter (`mcp/cloudflare.ts`, worker/zone data) are
implemented against each service's documented contract but **unverified**
— this environment has no API keys or Cloudflare account token to test
them with. Neither is on the default path; nothing breaks without them.
See [`ADR-006`](docs/decisions/ADR-006-model-providers.md) and
[`ADR-005`](docs/decisions/ADR-005-shared-memory.md).

A fourth provider, **Groq**, *is* verified end-to-end against a real key —
set `MODEL_PROVIDER=groq` and `GROQ_API_KEY` in `.dev.vars` (see
`.dev.vars.example`) for real narration in local dev with no Cloudflare
account at all. See [`ADR-019`](docs/decisions/ADR-019-groq-provider.md).
`workers-ai` stays the default for an actual deployment.

## What's real vs. what's a placeholder

Full table: [`docs/architecture.md`](docs/architecture.md#whats-real-vs-what-s-a-stand-in),
and the requirement-by-requirement matrix:
[`docs/completion-status.md`](docs/completion-status.md). Short version:
the agent, shared memory, risk/policy/GitOps engines, all three workflows'
approval loops, the MCP server, Code Mode's sandboxed execution,
observability, and the React dashboard are real and verified end-to-end —
the dashboard specifically via a checked-in headless-browser suite
(`npm run test:e2e`, Playwright) exercising the full analyze → workflow →
approve → remediation cycle, the incident flow, and the evals/productivity
pages, with zero console errors. GitHub/CI data is fixture-backed, not a
live integration —
[`ADR-002`](docs/decisions/ADR-002-mcp-vs-direct-tools.md).

## Repository layout

```
apps/dashboard/         React + Vite + Tailwind SPA (built to dist/, served
                         via Workers Assets) — src/pages/ has Chat, Evals,
                         Productivity; src/hooks/useAgentSocket.ts owns the WebSocket
src/worker.ts           entry point — routes to the agent, /mcp, /productivity/*
                         and /evals/runs + /evals/compare (D1 history APIs — never
                         the bare /evals or /productivity page path, see ADR-017),
                         or assets
agents/
  session-agent.ts        Durable Object shell (WebSocket, state, audit SQL)
  planner.ts               classifies intent, dispatches to a specialist agent
  release-agent.ts         PR analysis, remediation plan, release workflow
  incident-agent.ts        incident memory lookup + incident workflow
  codemode-investigate.ts  sandboxed multi-tool investigation (Code Mode)
  model.ts                 provider-agnostic LLM call (Workers AI/OpenAI/Anthropic)
  intent.ts, prompts.ts, service-aliases.ts, types.ts
workflows/               ReleaseWorkflow, IncidentWorkflow, RemediationWorkflow,
                         idempotent-create.ts (replay-safe instance creation)
durable-objects/         EngineeringMemoryStore (shared incident/fact memory)
mcp/                     real MCP server (9 tools) + fixture-backed GitHub/CI
                         data + tool metadata registry + Cloudflare API adapter
gitops/                  desired/deployed/CI-commit drift detection
risk/                    deterministic risk scoring (7 dimensions)
policy/                  policy-as-code (YAML) + enforcement engine
incident/                extracted, testable root-cause correlation
remediation/             extracted, testable remediation plan generator
context/                 ranked, deduplicated, token-budgeted context assembly
productivity/            developer-productivity metrics (fixtures, aggregation, API)
audit/                   structured, request-correlated, secret-redacting audit trail
observability/           structured JSON events for LLM/tool/context calls
memory/                  portable SQL helpers (incidents, audit, engineering facts)
fixtures/                synthetic PR/service/CI/incident/GitOps data
evals/                   risk, tool-selection, policy, memory, incident, remediation, regression;
                         history-api.ts (D1-backed run history/comparison), compare.ts (pure diff)
migrations/eval-history/ D1 schema for eval run history (ADR-015)
tests/                   vitest unit tests; tests/security/ for safety invariants (10 files)
tests/e2e/               Playwright smoke suite against a live wrangler dev instance (ADR-016)
scripts/                 verify-mcp-server.mjs, record-eval-run.mjs (real integration tests
                         against wrangler dev)
docs/                    architecture, demo script, threat model, evals, completion status, ADRs
```

## More

[`docs/architecture.md`](docs/architecture.md) ·
[`docs/demo.md`](docs/demo.md) ·
[`docs/threat-model.md`](docs/threat-model.md) ·
[`docs/evals.md`](docs/evals.md) ·
[`docs/completion-status.md`](docs/completion-status.md) ·
[`docs/decisions.md`](docs/decisions.md) (20 ADRs)

<!-- test PR for verifying live GitHub PR fetch -->
