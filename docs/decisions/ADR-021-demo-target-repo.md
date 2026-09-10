# ADR-021: A separate demo target repo, not ForgeGuard's own

## Status
Accepted

## Context
Once merge/close became a real GitHub API call (see the fixture-removal
work this ADR follows), `GITHUB_REPO` pointing at ForgeGuard's own repo
had a real consequence: using ForgeGuard — the actual feature being
demonstrated — meant ForgeGuard could change its own source code. A
reviewer opening a PR against ForgeGuard itself, walking it through
analysis and approval, and clicking "merge this pr" would genuinely
merge a change into the tool they're evaluating, mid-evaluation. That's
not a hypothetical edge case; it's the literal happy path of the demo.

## Decision
`GITHUB_REPO` now points at a separate, purpose-built repo,
[`forgeguard-demo`](https://github.com/NAVEENKUMARKR777/forgeguard-demo)
— a small, real, independently deployed Cloudflare Worker (a D1-backed
task-tracker API, with its own real CI). It exists for exactly one
reason: to be a safe place to open a real PR, watch it show up in
ForgeGuard's dashboard, and merge or close it for real, without any risk
to ForgeGuard's own codebase. It's not a mock or a stub — it's checked
in, has its own passing CI (`verify` + `e2e` jobs, mirroring ForgeGuard's
own job names so `policy/policies.yaml`'s `required_checks` still means
something), and is deployed live at
`forgeguard-demo.forgeguard.workers.dev`.

This introduced a real conflict `GITHUB_REPO` alone couldn't resolve:
`gitops/state.ts`'s job is "is the deployed Worker in sync with git" —
inherently a question about ForgeGuard's *own* repo, regardless of which
repo PR analysis is pointed at. Repointing `GITHUB_REPO` at
`forgeguard-demo` would have made the GitOps drift check compare
ForgeGuard's deployed commit against a repo that has nothing to do with
what's actually deployed. A new var, `DEPLOY_REPO`, always names
ForgeGuard's own repo and is used only by `gitops/state.ts`; everywhere
else (`mcp/github.ts`, `mcp/cicd.ts`, `mcp/github-write.ts`,
`productivity/fixtures.ts`) keeps reading `GITHUB_REPO`, the PR-analysis
target.

The single real `ServiceMeta` (`mcp/github.ts`) is now derived from
`GITHUB_REPO` at request time (`serviceMetaFor()`) instead of hardcoded
to "forgeguard" — it was already meant to describe whatever repo is
actually being analyzed, and hardcoding it would have silently gone
stale the moment `GITHUB_REPO` changed, which is exactly what happened
here.

## Consequences
- Merge/close, and everything upstream of it (analyze, approve, the
  remediation workflow's real-CI wait), now only ever touches
  `forgeguard-demo` — verified against real PR #1 there
  (`scripts/verify-mcp-server.mjs`, `npm run verify:mcp`).
- ForgeGuard's own GitOps drift check is unaffected by this change —
  still real, still comparing `DEPLOY_REPO`'s `master` HEAD against the
  actually-deployed Worker version, verified separately (they matched,
  reporting `in_sync`, immediately after a tagged deploy).
- Two repos to keep in sync mentally when reading logs/dashboards: this
  repo (`forgeguard`) is the tool; `forgeguard-demo` is what it acts on.
  The README links both, and every place in this codebase that reads
  `GITHUB_REPO` vs. `DEPLOY_REPO` is commented with which one and why.
- If `GITHUB_REPO` is ever repointed again (a different demo target, or
  back at a real production repo in a non-demo deployment),
  `DEPLOY_REPO` still needs to be set separately and correctly to
  whatever repo is actually deployed — it does not track `GITHUB_REPO`
  automatically, by design.
