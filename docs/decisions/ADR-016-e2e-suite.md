# ADR-016: Checked-in Playwright smoke suite, separate from `npm test`

## Status
Accepted

## Context
Every subsystem added in this project had, at some point, been verified by
hand: start `wrangler dev`, open the dashboard, type a message, click
Approve, watch it work. That verification was real but disposable — it
proved the system worked once, for one person, and left nothing behind for
the next change to run against. Vitest covers pure logic (risk scoring,
policy, `compareRuns`, etc.) but nothing exercises the actual running
Worker plus a real browser: the WebSocket chat protocol, the Workflow
approval pause, the built React bundle served from Workers Assets.

## Decision
`tests/e2e/*.spec.ts` (Playwright) checks in the manual verification passes
as an explicit, separate command — `npm run test:e2e` — not part of
`npm test`/`vitest run`. A browser plus a live Worker is a materially
heavier dependency than the rest of the suite needs, so it gets its own
script and can get its own CI job rather than slowing down (or adding
browser-install flakiness to) every `npm test` run.

Four specs cover the critical paths:
- `release.spec.ts` — the central architectural claim (ADR-003): analyze →
  explain → remediate → human approval → auto-remediation, against a real
  Workflow instance.
- `incident.spec.ts` — memory lookup, live symptom investigation, approval-
  gated rollback.
- `evals.spec.ts` — the `/evals` page renders real suite output and the
  D1-backed history/comparison section (ADR-015).
- `productivity.spec.ts` — aggregated metrics render and are honestly
  labeled as synthetic fixture data.

`playwright.config.ts`'s `webServer` builds the dashboard, applies D1
migrations, and starts `wrangler dev --local` itself — `npm run test:e2e`
is self-contained, no separately-running dev server required.

## Consequences: three real bugs found by building this, not hypothetical

**1. Deterministic idempotency keys make repeated runs test the wrong
thing.** `release-agent.ts`'s idempotency keys (ADR-010) are deterministic
per fixture (`release-1842`, ...). Running the suite against a
`.wrangler/state` left over from a previous run — or from manual testing —
made `createIdempotent()` correctly find and reuse the already-completed
instance instead of creating a fresh one, so the approval step silently
never appeared. This is `createIdempotent()` working exactly as designed;
the test's assumption of a fresh workflow was the thing that was wrong.
Fixed by prepending `rm -rf .wrangler/state &&` to `webServer.command` —
every `test:e2e` run starts from a clean slate.

**2. Locator strict-mode violations, twice, both test-authoring bugs, not
app bugs.** `text=/PR #1842/` matched three elements (sidebar, chat
message, aside heading) — fixed by scoping to
`page.locator("aside").getByText(...)`. Separately, `evals.spec.ts`
asserted for the literal phrase `"No recorded run history"`, but
`EvalRunHistory.tsx` renders one of *two* distinct empty-state messages
depending on why there's nothing to show — `"No recorded run history
yet..."` when the `/evals/runs` fetch itself fails, `"No recorded runs
yet..."` when it succeeds but returns zero rows (the actual case on a
freshly-migrated database). The regex only matched the first, so the test
failed against exactly the case it was meant to cover. Fixed by matching
both.

**3. A one-time "Worker's code had hung" error precedes each test that
opens a fresh WebSocket, and is benign.** Twice per run,
`wrangler dev --local` logs `Uncaught Error: The Workers runtime canceled
this request because it detected that your Worker's code had hung`. It
appears exactly once before `incident.spec.ts` and once before
`release.spec.ts` — the two specs that connect to the `SessionAgent`
Durable Object for the first time with a brand-new session id — and never
around `evals.spec.ts` or `productivity.spec.ts`, which never touch that
DO. It does not appear at all on the DO's second and subsequent
connections within the same run. The pattern points at a `wrangler dev
--local` cold-start artifact specific to the *first* WebSocket upgrade a
freshly-instantiated Durable Object handles in a given local session, not
a bug in `session-agent.ts` or `useAgentSocket.ts`. It is invisible to the
user and to these tests because `useAgentSocket.ts` already reconnects
with backoff on any closed connection (that behavior exists for real
network drops, not for this) — the socket that failed is silently replaced
by the one the retry opens, `status` reaches `"open"`, and every assertion
downstream passes normally. No code change was made for this: there is
nothing in this codebase's control to fix, and the retry path it exercises
is the same one that handles a real dropped connection in production.

- `vitest.config.ts` (new) excludes `tests/e2e/**` — both frameworks match
  `*.spec.ts` by default, and vitest would otherwise try and fail to
  execute Playwright's `test()`/`expect()` calls.
- `workers: 1` (serial execution): a single `wrangler dev --local` process
  is single-threaded, and four spec files hitting it concurrently produced
  real contention that pushed workflow-approval polling past its timeout —
  observed directly, not a defensive default. Shared local D1/DO state
  across specs (bug #1 above) is a second, independent reason this suite
  is not a candidate for parallelization even if that contention were
  solved.

**4. An assertion was accidentally coupled to the no-AI fallback's exact
wording, not to anything deterministic.** `release.spec.ts` originally
asserted `text=/Risk .*100/` after the analyze step. Every run of this
suite before ADR-019 used the `workers-ai`/"not supported" fallback path
(`Risk ${total}/100 (${band})...`, one plain string), so the regex trivially
matched. Turning on a real provider (ADR-019, `MODEL_PROVIDER=groq`) for
the first time surfaced that this had never actually tested the
deterministic risk gauge (`RiskGauge.tsx` renders the score, `/ 100`, and
band as three separate `<span>`s) — it was silently riding on the fallback
message's specific phrasing, and real markdown-formatted LLM prose (headers,
tables) splits "Risk" and the score across separate elements a single-locator
regex can't span. Fixed by asserting on the risk band label
(`aside`'s `HIGH|CRITICAL` text) instead, which is deterministic, provider-
independent, and was always the thing this test meant to check. Also
surfaced in the same run: `incident.spec.ts`'s rollback approval records a
real incident into the shared `EngineeringMemoryStore` (ADR-005) before
`release.spec.ts` runs later in the same suite invocation, so PR #1842's
"historical incidents" risk component — and therefore its total score — is
genuinely higher on this pass (71) than the fixture's documented baseline
(64) once both specs have run. Harmless (no assertion depends on the exact
number), but worth knowing: this suite's specs are not fully independent of
each other's ordering within one `npm run test:e2e` invocation.
