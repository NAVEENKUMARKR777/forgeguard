# Evals

`npm run evals` runs `evals/run.ts` and writes
`apps/dashboard/public/eval-results.json`, which `/evals` renders — real
pass/fail counts from the actual code, not hand-typed metrics. There is no
"accuracy percentage" anywhere in this repo that isn't computed from an
eval actually running.

## Suites

- **`evals/risk/`** — feeds a fully inline, synthetic PR object (not this
  repo's real GitHub data — see ADR-002 on why these stay fixture-free-but-
  deterministic rather than hitting the live API) into
  `assessRisk()`/`evaluatePolicy()` and asserts the resulting band and
  approval decision. Four cases spanning LOW through HIGH.
- **`evals/tool-selection/`** — asserts `selectTool()` (the deterministic
  keyword router in `mcp/registry.ts`) picks the tool a human would expect
  for a given question.
- **`evals/policy/`** — isolates the policy engine specifically: forbidden
  paths, the changed-files ceiling, and missing required checks each force
  `approvalRequired`.
- **`evals/memory/`** — exercises the real `remember()`/`recall()` functions
  (`memory/engineering.ts`) against an in-memory fake SQL backend
  (`evals/memory/fake-sql.ts`, since Node has no Durable Object storage),
  and checks recall doesn't leak across services.
- **`evals/incident/`** — exercises `correlateIncident()`/
  `rollbackRequiresApproval()` (`incident/correlate.ts`, extracted from
  `workflows/incident-workflow.ts`): a repeat incident on a high-criticality
  service should require approval at high confidence; the same signal on a
  low-criticality service should not (`rollbackRequiresApproval()` only
  special-cases `"high"` — `"low"` and `"medium"` behave identically, but a
  case actually testing `"low"` is what its own name promises).
- **`evals/remediation/`** — exercises `buildRemediationPlan()`
  (`remediation/plan.ts`, extracted from `agents/release-agent.ts`): a
  failing check produces a named fix step, a migration produces a
  separate-deploy step, `approvalRequired` produces an approval step.
There used to be a seventh suite, `evals/regression/`, locking one
fixture PR's exact risk score against a checked-in baseline. It's gone —
once there was no fixture left to lock (see ADR-002), "did the score for
PR #1842 change" stopped being a meaningful question. The `risk`/`policy`
suites above already cover the same regression-guard purpose against
inline, versioned inputs.

## Run history and comparison

`npm run evals` alone doesn't persist anything beyond the single latest
`eval-results.json`. `npm run evals:record` (`scripts/record-eval-run.mjs`)
runs the same suite, then spins up a temporary `wrangler dev` to persist
the result to D1 (`migrations/eval-history/0001_init.sql`,
`evals/history-api.ts`) and print a comparison against the previous
recorded run. `/evals` renders that history — previous runs and a
pass-rate/newly-failing/newly-passing delta — via
`GET /evals/runs` and `GET /evals/compare?from=…&to=…`. See
[`ADR-015`](decisions/ADR-015-eval-history.md) for why D1 over KV or
committed JSON, and `evals/compare.ts`
(unit-tested in `tests/eval-comparison.test.ts`) for the diff logic
itself, which has no D1 dependency.

`npm run evals` (used by CI) never touches D1 — recording history is a
separate, explicit command.

## MCP contract check

`npm run verify:mcp` (`scripts/verify-mcp-server.mjs`) is a real integration
test, not a unit test with faked bindings: it starts the actual Worker
under `wrangler dev --local` and sends genuine JSON-RPC requests to `/mcp`,
asserting on `tools/list` and four `tools/call`s across three tools
(`get_pull_request` — including an unknown-PR case, checking the server
returns `isError` rather than crashing — `get_reviews`, and `search_code`).
It's a plain Node script rather than a vitest test because
`@cloudflare/vitest-pool-workers` — the standard way to unit-test Workers
code with real bindings — currently requires vitest ^4.x, and this project
is on vitest 5 (same kind of version gap as `typescript-eslint` and
TypeScript 7 — see `.github/workflows/ci.yml`).

## What's deliberately not an eval

Whether the model's *prose explanation* is good is not evaluated here — an
LLM-as-judge grading English explanations would be inherently fuzzy and
somewhat expensive to run on every change, and every decision the
explanation describes is already covered by a deterministic eval above (see
`docs/decisions/ADR-003-policy-vs-llm.md`). If that mattered more than it
does for this scaffold, the natural next eval suite would score
explanations against a rubric (cites the failing check by name, states the
approval requirement plainly, stays under the prompt's length cap) rather
than trying to assert exact wording.

## Security tests

`tests/security/*.test.ts` (run via `npm run test`, not `npm run evals`)
check structural safety properties — see `docs/threat-model.md` for what
each one defends against and why it's a vitest test rather than an eval:
they assert invariants about the *code* (which functions call `sendEvent`,
which tools are registered), not classification accuracy against labeled
examples.
