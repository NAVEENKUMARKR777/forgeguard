# ADR-020: A false-negative `reused` flag blocks deployment, not just gets a footnote

## Status
Accepted

## Context
ADR-010 documented that local dev's Workflows simulator doesn't enforce
"an existing instance id throws on `create()`" the way production does, and
ADR-016 worked around it for the Playwright suite by wiping
`.wrangler/state` before every run. Neither addressed the actual
interactive demo: a reviewer running `npm run dev` and clicking through
`docs/demo.md` more than once in the same dev session (or restarting
`npm run dev` without wiping state) hits the same gap directly. Reported
directly from a real run: asking to "Start the remediation workflow" a
second time for PR #1842 produced

```
Started release workflow release-1842. It will pause for approval if policy requires it.
Release workflow finished with status: complete.
Deployment approved — remediation workflow remediation-1842 is rolling it out via canary.
```

with no approval pause visible at all — `createIdempotent()`'s `reused`
flag came back `false` (local dev let `create()` succeed silently against
the already-existing id instead of throwing), so `startWorkflow()` printed
the "fresh start" message, but the instance it then polled was the
*already-completed* one from earlier in the session. Confirmed this isn't
an approval-bypass: `pollWorkflow()`'s fallback path (for local dev's
separate "waiting" status-reporting gap, ADR-004) only ever calls
`markWaitingForApproval()`, never auto-resolves anything — the underlying
approval gate was never actually skipped, the *reporting* of what happened
was just misleading.

## Decision
A genuinely fresh workflow instance whose policy requires approval cannot
reach a terminal status without first parking on `waitForEvent` — that path
returns immediately, before ever reaching the terminal-status branch. So if
a poll chain started immediately after `startWorkflow()`/
`startIncidentWorkflow()` (marked with a new `freshStart` flag, threaded
through the recursive re-poll calls, default `false`) reaches a terminal
status while approval was required, that's an unambiguous signal the
`reused: false` it was given was a false negative — not this request's own
approval cycle completing.

The first version of this fix (still worth recording, since it was wrong in
a specific, instructive way) computed `staleReuse` and appended an
explanatory footnote to the existing "Release workflow finished with
status: complete." / "Outcome: rolled_back." messages, while still calling
`maybeStartRemediation()` and still reporting "Deployment approved —
remediation workflow ... rolling it out via canary." That was rejected on
review: even with an accurate footnote attached, a transcript that reads
"Started release workflow..." → "...finished with status: complete" →
"Deployment approved" *asserts an authorization that did not happen in this
conversation*, and a reviewer skimming the transcript could reasonably read
it as the human-approval gate being bypassed — even though tracing the
actual code confirms it wasn't (the ADR-004 local-status-gap fallback path
only ever calls `markWaitingForApproval()`, never resolves anything).
Explaining a false "approved" after the fact is weaker than the system
being structurally unable to say it.

`pollWorkflow()` (`agents/release-agent.ts`) and `pollIncidentWorkflow()`
(`agents/incident-agent.ts`) now **stop before ever reaching the
"approved"/"rolling it out"/"Outcome: rolled_back" messages** when
`staleReuse` is true: they report deployment/rollback as not authorized in
this conversation and `return` immediately, so `maybeStartRemediation()` is
never called and the outcome/hypothesis split never renders an "Outcome:"
line for a stale result. `handleApproval()`/`handleIncidentApproval()`'s
own poll calls don't set `freshStart`, so a real, legitimate post-approval
completion is never affected by this — verified directly, and the full
Playwright suite (which always starts from wiped state, so `staleReuse`
should never fire there) still passes unchanged, including the assertion
that a genuine approval *does* still show "rolling it out via canary."

`docs/demo.md` also gained an upfront callout: restart with a clean
`.wrangler/state` before demoing if you've clicked through the approval
flow before in the same dev session.

## Consequences
- The one real behavior change: a stale-reused terminal result no longer
  starts remediation or reports an incident outcome as if it happened now.
  A genuinely fresh, approved run is completely unaffected — verified via
  the e2e suite's existing "rolling it out via canary" assertion still
  passing.
- Verified live, both ways: reproduced the exact scenario (PR #1842
  analyzed, then "Start the remediation workflow" against a `.wrangler/state`
  where `release-1842` already existed and had completed) and confirmed the
  chat now says "Deployment blocked here: no approval action has occurred
  in this conversation" with no "approved" message anywhere in the
  transcript; separately confirmed the same reproduction against a clean
  state still produces the full analyze → approve → "rolling it out via
  canary" sequence.
- This is a local-dev/demo-only distinction — production Cloudflare
  Workflows enforces unique instance ids correctly (per Cloudflare's own
  documented contract, ADR-010), so `staleReuse` should never actually
  evaluate `true` there, and this code path should never trigger outside
  local dev.
