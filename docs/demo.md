# Demo script

Requires `npm run dev`. Everything below works with no Cloudflare account
except step 1's plain-language explanation (needs `wrangler login` or
`--remote` for Workers AI — see README); risk/policy/workflow/memory/MCP
steps all work in plain local dev.

**If you've clicked through steps 4/5 or 7 before in this same dev
session** (or restarted `npm run dev` without stopping the previous one),
restart with a clean state first:

```
rm -rf .wrangler/state
npm run dev
```

Local dev's Workflows simulator doesn't enforce unique instance ids the way
production does (ADR-010), so "Start the remediation workflow" against a PR
you've already approved before will find that already-completed instance
instead of a fresh one. ForgeGuard will not report a fresh "Deployment
approved" from that — it explicitly blocks with "no approval action has
occurred in this conversation" instead (ADR-020) — but you also won't see
the approval step to click through. Starting clean is the way to see the
actual approval flow.

1. **Analyze.** Type `Is PR #1842 safe to deploy?`
   Pipeline steps tick through fetch-evidence → fetch-gitops → risk-analysis
   → policy-check (fetch-evidence runs via Code Mode's sandboxed Worker when
   available — see ADR-007; fetch-gitops is a separate step feeding risk
   scoring as its 7th dimension — see ADR-009), then a risk score
   (64/100, HIGH) and an explanation.

2. **Explain.** Type `Why is it risky?`
   Lists the scored components without re-running the pipeline.

3. **Remediate.** Type `What should I fix first?`
   A concrete, ordered plan built from the actual failing checks and policy
   flags.

4. **Start the workflow.** Type `Start the remediation workflow`
   A real `ReleaseWorkflow` instance starts; policy flags this PR as
   needing approval, so it parks on `waitForEvent`. The dashboard's
   Approve/Reject buttons light up.

5. **Approve.** Click Approve (or type `approve`).
   `sendEvent(...)` resumes the workflow; on completion, a
   `RemediationWorkflow` automatically starts and simulates the
   canary → check-health → promote → verify rollout.

6. **Incident memory.** Type `Investigate the payment-service incident`
   Pulls INC-1042 from the shared `EngineeringMemoryStore` — the same prior
   incident the risk score already factored in at step 1.

7. **Live incident.** Type `Payments are returning 500s, investigate`
   Starts a real `IncidentWorkflow`: correlates the symptom against
   engineering memory, produces a confidence-scored root-cause hypothesis,
   and (since payment-service is high-criticality) pauses for rollback
   approval.

8. **Teach it something.** Type `Remember that checkout-service uses
   blue-green deployment`, then later ask `How should we deploy
   checkout-service?` — the answer is grounded in what you just told it
   (`memory/engineering.ts`, verified via `evals/memory`).

9. **MCP server.** `curl -X POST http://localhost:8787/mcp` with a
   `tools/call` JSON-RPC body works from any MCP client, independent of the
   chat session — try `get_incident_history` after step 7 and see the same
   rollback recorded from the workflow.

10. **Voice.** Click the microphone button (Chrome/Edge) and say "Is PR
    eighteen forty-two safe to deploy" instead of typing it.

11. **Productivity.** Open `/productivity` — PR cycle time, CI/deploy
    reliability, AI-investigation volume, and MTTR, aggregated from real
    (clearly `source: "fixture"`-labeled) daily data, filterable by service
    and time range.

Run `npm run evals` to see the deterministic risk/policy/tool-selection/
memory/regression checks pass independent of any of the above, and open
`/evals` to see the same results rendered — including run-over-run history
if you've run `npm run evals:record` at least twice. `npm run test:e2e`
exercises this entire script end-to-end against a real browser.
