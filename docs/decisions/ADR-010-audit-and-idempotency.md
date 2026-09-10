# ADR-010: Structured audit trail + workflow idempotency keys

## Status
Accepted

## Context
`memory/audit.ts` already recorded action/detail/timestamp rows, but with
no way to reassemble "everything that happened while handling this one
message" or "everything tied to this one workflow" — every call site
invented its own detail shape. Separately, every workflow-starting call
(`startWorkflow`, `startIncidentWorkflow`, `maybeStartRemediation`) let
Cloudflare assign a random instance id, so asking the agent to "start the
remediation workflow" twice in a row — a double click, a retried request —
created two independent workflow instances for the same PR.

## Decision
`audit/recorder.ts#recordAuditEvent()` wraps the existing
`memory/audit.ts#recordAudit()` (no schema change) with a consistent shape
(`requestId`, `sessionId`, `workflowId`, `actor`) and recursive redaction
(`redact()`) of anything key- or value-shaped like a secret before it's
persisted. `agents/types.ts#AgentContext` gained `requestId` (a fresh UUID
per inbound WebSocket message, generated in `session-agent.ts`) and
`sessionId`, threaded into every audit call. `audit/queries.ts` can
reassemble a full trail by either id.

`workflows/idempotent-create.ts#createIdempotent()` passes a deterministic
`id` to `Workflow.create()` — `release-<prNumber>`, `remediation-<prNumber>`,
`incident-<service>-<hourBucket>` (hour-bucketed because, unlike a PR, an
incident recurs — a bare `incident-<service>` key would wrongly collide
with a long-resolved past incident for the same service) — and falls back
to `Workflow.get()` on a creation error, per Cloudflare's documented
behavior ("If a provided id exists, an error will be thrown").

## Consequences
- Discovered empirically against a live `wrangler dev`: Workflow instance
  ids reject `:` (`WorkflowError: Workflow instance has invalid id`) — the
  keys use `-` throughout.
- Also discovered empirically: **local dev's Workflows simulator does not
  enforce the "id must be unique" throw** that production is documented to
  — calling `create()` twice with the same id succeeded both times locally
  instead of rejecting the second call. This is the same category of gap
  as ADR-004's `"waiting"` status not being reported locally: the
  mechanism is implemented exactly per the documented contract, but the
  specific guarantee (a second `create()` for an in-flight id is rejected,
  so `get()` returns the *same* in-progress run rather than a new one) is
  unverified against local dev and needs re-confirming against a real
  deployment. What *is* verified locally: every workflow now gets a
  stable, predictable id instead of an untrackable random one, and the
  approval/poll flow works unchanged with that id.
- `evals/regression/baseline.json` and all other evals needed no changes —
  none of them start a Workflow instance.
