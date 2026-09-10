# ADR-004: Cloudflare Workflows for the release process, not the Durable Object

## Status
Accepted

## Context
Once a release is judged high-risk, taking action on it (re-checking
policy, waiting for a human, recording the outcome) is a multi-step process
that can legitimately take hours (an approval might not arrive for a while).
That's a poor fit for a single request/response cycle, and a poor fit for
logic embedded directly in the chat Durable Object, which is meant to stay
responsive to the conversation.

## Decision
`workflows/release-workflow.ts` is a `WorkflowEntrypoint` with four steps:
`gather-evidence`, `assess-risk`, `evaluate-policy`, and (conditionally)
`await-approval` via `step.waitForEvent()`. `release-agent.ts#startWorkflow()`
creates an instance and polls it; `release-agent.ts#handleApproval()` calls
`instance.sendEvent({ type: "approval", payload: { approved } })` to unblock
it — both take the calling `SessionAgent`'s `AgentContext` as a parameter
rather than being methods on the Durable Object class itself (ADR-001's
`SessionAgent` stays just the WebSocket/state shell). Each `step.do()`
result is durably checkpointed by the Workflows engine independently of the
calling Durable Object.

## Consequences
- The workflow survives the calling `SessionAgent` being evicted or the
  browser tab closing — reconnecting and asking "what's the status of the
  workflow" would work if that read-path were built out (it isn't yet;
  `pollWorkflow` is the only reader today and only runs right after
  `start_workflow`/`approve`/`reject`).
- Local dev's status API does not reliably surface `"waiting"` while a
  workflow is parked on `waitForEvent` — it can keep reporting `"running"`.
  Production Cloudflare Workflows exposes `"waiting"` correctly. We
  discovered this empirically by hitting the local Explorer API directly
  and inspecting the step list, which showed the `await-approval` step
  genuinely parked with `success: null` even while the top-level status
  said `"running"`. `pollWorkflow()` therefore falls back to the policy
  decision it already computed (`policy.approvalRequired`) after a bounded
  number of polls, rather than waiting indefinitely on a status string that
  local dev may never report. `sendEvent`/`waitForEvent` themselves work
  correctly in both environments — only the status *label* is affected.
