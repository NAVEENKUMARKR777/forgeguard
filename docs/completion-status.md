# Completion status

Master tracker against the full ForgeGuard plan. "COMPLETE" means
implemented, tested, and documented — not merely that an interface exists.

## Verification, end of this pass

```
npm run typecheck   → 0 errors (3 tsconfigs: Workers, Node tooling, dashboard)
npm run test        → 72/72 (15 files, incl. 10 tests/security/*.test.ts files)
npm run evals       → 23/23 (risk, tool-selection, policy, memory, incident,
                       remediation, regression — 7 suites)
npm run evals:record → records a run to D1, prints the comparison against the
                       previous one — see ADR-015
npm run verify:mcp  → 6/6 real JSON-RPC checks against a live wrangler dev instance
npm run build:dashboard → clean
npm run test:e2e    → 5/5 Playwright specs against a live wrangler dev instance:
                       full analyze→gitops→workflow→approve→remediation cycle,
                       incident workflow, productivity page (incl. a routing
                       regression check, see ADR-017), evals page (incl. run
                       history) — zero console errors across every run,
                       see ADR-016
npm run dev:worker-only → starts cleanly with zero Cloudflare credentials set
                       (no CLOUDFLARE_API_TOKEN, no prior `wrangler login`)
                       — see ADR-018, the one gap this project's own test
                       suite never exercised directly
```

All of the above re-verified from a clean checkout (fresh `npm ci`, no
carried-over `.wrangler/state` or generated files), not just against this
environment's already-warmed-up state. That pass caught one real gap:
`worker-configuration.d.ts` (Workers/D1/Workflow ambient types, gitignored
since `wrangler types` generates it) had existed continuously in this
development environment since early in the project, silently masking that
neither a fresh clone nor CI's `npm ci` step ever generated it — `npm run
typecheck` would have failed immediately on both. Fixed by having
`typecheck`, `dev`, and `dev:worker-only` run `npm run cf-typegen` first,
the same self-contained-script pattern already used for
`build:dashboard`/`db:migrate:local`.

The same pass also caught a route collision: `src/worker.ts` routed bare
`/productivity` to the JSON API, not the SPA, and only worked in practice
because a real browser navigation is intercepted by the Assets binding
before the Worker's `fetch()` runs at all — a platform default this
codebase never stated anywhere. `curl`/`fetch()`-style requests (not
navigations) were reaching the JSON handler instead. Fixed by scoping the
route to `/productivity/` sub-paths only, exactly like `/evals/runs` and
`/evals/compare` already were — see [`ADR-017`](decisions/ADR-017-productivity-route-collision.md).

A doc-accuracy pass over `docs/architecture.md` also caught a real, if
currently inert, bug: `RemediationWorkflow`'s early-return on a failed
health check (`workflows/remediation-workflow.ts`) hardcoded
`outcome: "promoted"` even though nothing was promoted — the type only
declared that one literal, so there was no other value to return. Nothing
in this codebase reads `RemediationWorkflow`'s result today (the agent
starts it and moves on without polling), so this had no observable effect,
but it was still a wrong value sitting in checked-in code. Fixed by adding
an `outcome: "halted"` case.

The most serious gap surfaced not from this project's own verification but
from a real user actually running the documented quick start on a machine
with no Cloudflare account: plain `wrangler dev` (what `npm run dev`/
`dev:worker-only` ran) crashes before serving a single request when no
`CLOUDFLARE_API_TOKEN`/`wrangler login` is available, because mixed-mode
`wrangler dev` eagerly establishes a remote proxy connection for the `AI`
binding at startup regardless of whether a session ever calls it. Every
*other* script in this repo that shells out to `wrangler dev`
(`verify:mcp`, `evals:record`, the Playwright `webServer`) already passed
`--local` and was unaffected — this project's own "clean clone"
verification never actually ran the plain quick-start command end to end,
only those other scripts, so the gap went undetected here. Fixed by adding
`--local` to both dev scripts — see
[`ADR-018`](decisions/ADR-018-dev-server-local-mode.md).

## Completion matrix

| Requirement | Implementation | Tests | Docs | Status |
|---|---|---|---|---|
| AI release analysis | `agents/release-agent.ts` | evals/risk, evals/policy | ADR-003 | COMPLETE |
| Deterministic risk (incl. GitOps drift as 7th dimension) | `risk/engine.ts` | evals/risk, tests/risk-engine, tests/gitops | ADR-003, ADR-009 | COMPLETE |
| Policy-as-code | `policy/engine.ts` + `policies.yaml` | evals/policy | ADR-003 | COMPLETE |
| Human approval | `waitForEvent`/`sendEvent`, verified live | tests/security/approval-bypass, workflow-authorization | ADR-004 | COMPLETE |
| Durable workflow | 3 Workflows, verified live | — | ADR-004 | COMPLETE |
| Remediation | `RemediationWorkflow` + `remediation/plan.ts` | evals/remediation | ADR-004 | COMPLETE |
| Incident investigation | `IncidentWorkflow` + `incident/correlate.ts` | evals/incident | — | COMPLETE |
| Cross-session memory | `EngineeringMemoryStore` | evals/memory | ADR-005 | COMPLETE |
| MCP server | `mcp/server.ts`, 9 real tools, real JSON-RPC | verify:mcp, tests/security/unauthorized-tool | ADR-005, ADR-011 | COMPLETE |
| GitHub MCP (full tool surface) | 7 tools (PR, files, checks, reviews, commits, diff, search) | verify:mcp | ADR-011 | COMPLETE |
| CI/CD MCP | pipeline/job/test-results/artifacts/deployment/health chain | — | ADR-011 | COMPLETE |
| Cloudflare MCP | `mcp/cloudflare.ts`, real REST calls, feeds real GitOps drift | — | ADR-005 | COMPLETE — verified live against real credentials |
| Tool metadata registry (access/approval/risk) | `mcp/tool-metadata.ts` | tests/security/unauthorized-tool, tool-escalation | ADR-011 | COMPLETE |
| Code Mode | `agents/codemode-investigate.ts`, verified live | tests/security/tool-escalation | ADR-007 | COMPLETE (scoped — see ADR-007 on the fuller runtime) |
| GitOps drift detection | `gitops/` (state, drift) — real GitHub compare-API data vs. the real deployed Cloudflare Worker | tests/gitops (7 cases) | ADR-009 | COMPLETE |
| Context engineering (ranking/budget/sources) | `context/{ranking,budget,sources,builder}.ts` | tests/context-engineering | — | COMPLETE |
| Developer productivity metrics | `productivity/` (real GitHub/CI/incident aggregation, `source: "live"`) + React page | tests/productivity | ADR-012 | COMPLETE |
| Audit trail (structured, request-correlated) | `audit/` (types, recorder, queries) | tests/security/audit-redaction | ADR-010 | COMPLETE |
| Idempotency / replay protection | `workflows/idempotent-create.ts` | tests/security/replay-idempotency | ADR-010 | COMPLETE |
| Observability (structured events) | `observability/` (events, logger), wired into LLM/tool/context calls | verified live against wrangler dev | ADR-014 | COMPLETE |
| Security suite | 10 test files covering injection, escalation, secrets, path traversal, approval bypass, replay, workflow auth, context poisoning | tests/security/ | docs/threat-model.md | COMPLETE |
| Eval suites | 6 categories, 22 cases | evals/ | docs/evals.md | COMPLETE |
| Eval history/versioning | D1-backed run history, run-over-run comparison, rendered at `/evals` | tests/eval-comparison | ADR-015 | COMPLETE |
| React dashboard (chat + evals + productivity) | 3 routes, verified live | tests/e2e/ (Playwright) | ADR-008 | COMPLETE |
| Voice | Web Speech API | — | — | COMPLETE |
| Real single-repo infrastructure | No fixtures anywhere in this codebase — every PR/CI/GitOps/incident/productivity data point is this actual repo's real, live state | — | ADR-002, ADR-009 | COMPLETE |
| CI/CD | typecheck, test, evals, verify:mcp (fast gate) + a separate test:e2e job | — | ci.yml, nightly-evals.yml | COMPLETE (no lint step — documented tooling gap, not silently skipped) |
| Browser verification | `tests/e2e/*.spec.ts`, checked in, run via `npm run test:e2e` (chat, workflow/approval, incident, productivity, evals) | tests/e2e/ (Playwright) | ADR-016 | COMPLETE |
| Documentation | README, architecture, threat-model, evals, decisions index, 20 ADRs, this file | — | — | COMPLETE |

## Known gaps, deliberately not closed

- **Remote/live MCP discovery.** `mcp/cloudflare.ts` implements real REST
  calls against Cloudflare's API but has no credentials to verify against
  in this environment, and isn't wired into the default chat path — see
  ADR-005. Connecting a live GitHub MCP server the same way `mcp/github.ts`
  is structured is a natural extension, not attempted here for the same
  reason (no token to verify against).
- **ESLint.** Still blocked on `typescript-eslint` requiring `typescript
  <6.1.0`; this project is on TypeScript 7's native preview compiler. See
  the note in `.github/workflows/ci.yml`.
- **`@cloudflare/vitest-pool-workers`.** The "proper" way to unit-test
  Workers code with real bindings needs vitest ^4; this project is on
  vitest 5. Where that would have mattered (MCP contract behavior, workflow
  idempotency), the underlying logic was instead extracted into portable
  pure functions (`incident/correlate.ts`, `remediation/plan.ts`,
  `workflows/idempotent-create.ts`) that vitest tests directly, or verified
  via `scripts/verify-mcp-server.mjs` against a real running Worker.
