# ADR-013: Incident and remediation evals, by extracting the logic they test

## Status
Accepted

## Context
`workflows/incident-workflow.ts`'s root-cause correlation and
`agents/release-agent.ts#proposeRemediation`'s step-list generation were
both deterministic, but inline inside functions that need a live
Cloudflare Workflows runtime or a full `AgentContext` to call at all —
neither is available to `evals/run.ts` (a plain Node script).

## Decision
Extracted both into standalone pure functions: `incident/correlate.ts`
(`correlateIncident()`, `rollbackRequiresApproval()`) and
`remediation/plan.ts` (`buildRemediationPlan()`). The workflow and the
agent now call these instead of inlining the logic — same behavior,
verified by the full test/eval suite before and after — and
`evals/incident/cases.json` (4 cases) / `evals/remediation/cases.json`
(4 cases) exercise them directly, bringing the eval suite to 7 categories
(risk, tool-selection, policy, memory, incident, remediation, regression).

## Consequences
- This is the same pattern as ADR-009/ADR-010: pull a decision function out
  of its Workflow/Agent shell so it's unit-testable, rather than testing
  the shell (which would mean either mocking Cloudflare Workflows/Durable
  Object plumbing, or paying for `@cloudflare/vitest-pool-workers` and its
  vitest 4 requirement — see `.github/workflows/ci.yml`'s note on that gap).
- `rollbackRequiresApproval()` existing as its own function means the
  "high-criticality + confidence ≥ 60" threshold is asserted directly by
  an eval case (`low-criticality-service-never-requires-approval-even-at-
  high-confidence`) instead of only being implicit in the workflow's
  control flow.
