# ADR-009: GitOps drift as a bounded 7th risk dimension, not a rescoring

## Status
Accepted

## Context
ForgeGuard's risk score already had a fixed, tested 100-point rubric across
six dimensions, with a checked-in regression baseline
(`evals/regression/baseline.json`) locking PR #1842's score at 64. Adding
GitOps drift detection (desired vs. deployed vs. CI-validated commit) as a
real risk input needed to happen without silently moving that number for
every PR that has no drift at all — which is the common case.

## Decision
`gitops/drift.ts#detectDrift()` is a pure function over a `GitOpsState`
(commit refs with synthetic sequence numbers, since fixtures have no real
git ancestry to derive order from — see `types/gitops.ts`), returning one of
`in_sync | deployment_behind | deployment_ahead | reconciliation_failed |
unknown`. `risk/engine.ts` gained a `gitops_drift` component with a 5-point
budget, taken from the `dependency` component's budget (10 → 5) rather than
added on top — `dependency` has always scored 0 (it's an acknowledged
placeholder, no dependency-manifest diffing exists), so this changes no
existing test's total. `gitopsDrift` is an *optional* field on `RiskInput`;
omitting it (as every pre-existing eval/test still does) scores 0, exactly
matching prior behavior.

`agents/release-agent.ts#analyzeRelease()` now fetches real GitOps state for
the PR's service as its own pipeline step (`fetch-gitops`) and passes the
drift result into `assessRisk()`. `incident-agent.ts` and
`workflows/incident-workflow.ts` also read GitOps state — a service with
active deployment drift is now a real (not fabricated) contributor to
incident root-cause confidence.

## Consequences
- `evals/regression/baseline.json` needed no change — verified by running
  the full eval suite before and after.
- Ahead/behind is derived from a synthetic per-fixture `seq` ordinal, not
  real commit timestamps or ancestry. A live-GitHub mode would replace this
  with `git merge-base`/compare-API output; nothing downstream (`detectDrift`,
  the risk component, the incident correlation) needs to change to accept it,
  since they only depend on the `GitOpsState` shape, not on how `seq` was
  derived.
- Insufficient evidence (`missing commit`, `unknown deployment status`, or a
  commit absent from the known sequence) always resolves to `"unknown"`
  rather than guessing a direction — this was a deliberate test case
  (`tests/gitops/drift.test.ts`), not an oversight.

## Update

The predicted live-GitHub swap happened: `gitops/state.ts` now computes
`desiredCommit` from `master`'s real HEAD and `deployedCommit` from the
real, currently-deployed Cloudflare Worker's version (its deployment
message annotation, tagged with the git SHA at deploy time — see
`mcp/cloudflare.ts` and `.github/workflows/ci.yml`'s deploy job), and
ahead/behind comes from GitHub's real compare API instead of the synthetic
`seq` ordinal — simpler than what it replaced, and exactly what this ADR
said would happen with no changes needed in `detectDrift` or the risk
component. There's also now only one real deployable thing (this Worker),
so `GitOpsState` dropped its `service`/`environment` dimensions along with
`healthStatus`, which turned out to have been unused even before this
change. `tests/gitops/drift.test.ts` now constructs `GitOpsState` objects
inline rather than pulling them from a fixture-backed lookup — same
principle as the risk/policy evals in ADR-002.
