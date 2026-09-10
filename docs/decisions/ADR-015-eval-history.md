# ADR-015: D1 for eval run history, over KV or committed JSON artifacts

## Status
Accepted

## Context
`/evals` only ever showed the latest run (`apps/dashboard/public/eval-results.json`,
overwritten on every `npm run evals`). Comparing runs over time — "did
this change regress tool-selection?" — needed real persistence. Three
options were considered:

- **Committed JSON artifacts** (e.g. `evals/history/*.json` checked into
  git). Rejected: the Worker serving `/evals` has no write access to the
  repo, and "history" would only ever reflect whatever a developer
  happened to commit, not a live, queryable record.
- **KV.** Would work for storing one blob per run, but comparing two runs
  or filtering by suite means fetching and parsing many blobs client-side
  — there's no query capability for what is fundamentally relational data
  (a run has many cases; comparing runs means joining on suite+name).
- **D1.** Chosen. `eval_runs` and `eval_cases` are two small tables with an
  obvious relationship; `evals/history-api.ts`'s `/evals/compare` endpoint
  is a couple of `SELECT`s and a join done in code, not a client-side
  reconstruction of relational logic KV can't express.

## Decision
`migrations/eval-history/0001_init.sql` defines `eval_runs`/`eval_cases`.
`evals/compare.ts#compareRuns()` is a pure diff function (no D1
dependency, unit-tested in `tests/eval-comparison.test.ts`) that
`evals/history-api.ts` calls after fetching two runs from D1. Writing
happens from a new, separate command — `npm run evals:record`
(`scripts/record-eval-run.mjs`) — which runs the existing `npm run evals`
unchanged, then spins up a temporary `wrangler dev` (same pattern as
`scripts/verify-mcp-server.mjs`) to `POST` the result to `/evals/runs`
before tearing down. **`npm run evals` itself is untouched** — still the
fast, infra-free command the CI gate (`ci.yml`) runs; recording history is
opt-in, not a hidden side effect of the command every other workflow
depends on.

## Consequences
- Verified fully local, no Cloudflare account: `wrangler d1 migrations
  apply forgeguard-eval-history --local` and subsequent inserts/queries
  all work against `.wrangler/state`'s local SQLite simulation with no
  `database_id` pointing at a real database and no `wrangler login`. This
  matches the project's established pattern (Workflows, Durable Objects,
  Worker Loaders all work the same way) — D1 continues it rather than
  breaking it.
- The React `/evals` page's "Run comparison" / "Previous runs" sections
  degrade gracefully (a plain message, not a crash) when no history has
  been recorded yet, or when only one run exists to compare against.
- `nightly-evals.yml` still only runs `npm run evals` — it was deliberately
  left alone rather than switched to `evals:record`, since CI runners don't
  have a git commit worth attributing (shallow clones, ephemeral state) and
  wiring persistent CI history into a database this project doesn't deploy
  anywhere is a separate, real infrastructure decision (which D1 database,
  which account) outside this pass's scope.
