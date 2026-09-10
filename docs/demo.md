# Demo script

Requires `npm run dev`, a `GITHUB_TOKEN` in `.dev.vars` (see
`.dev.vars.example` — needs no special scopes beyond reading the repo
you point `GITHUB_REPO` at), and `wrangler login` or `--remote` for
Workers AI (step 1's plain-language explanation). Everything reads/writes
the real GitHub repo `GITHUB_REPO` names — no fixtures left in this
codebase (see `ADR-002`). Steps 4/5 (merge/close) make a real GitHub API
call: use a throwaway PR you don't mind actually merging or closing.

**If you've clicked through steps 3 before in this same dev session**
(or restarted `npm run dev` without stopping the previous one), restart
with a clean state first:

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

Open a real PR on the repo `GITHUB_REPO` points at before starting — the
sidebar shows it live, or reference it by number directly.

1. **Analyze.** Type `Is PR #N safe to deploy?` (your real PR number)
   Pipeline steps tick through fetch-evidence → fetch-gitops → risk-analysis
   → policy-check (fetch-evidence runs via Code Mode's sandboxed Worker when
   available — see ADR-007; fetch-gitops is a separate step feeding risk
   scoring as its 7th dimension, computed from real GitHub compare-API data
   against the real deployed Cloudflare Worker — see ADR-009), then a real
   risk score and an explanation.

2. **Explain / remediate.** Type `Why is it risky?` then
   `What should I fix first?` — the scored breakdown, then a concrete
   ordered plan built from the PR's actual failing checks and policy flags.

3. **Start the workflow, approve.** Type `Start the remediation workflow`.
   A real `ReleaseWorkflow` instance starts; if policy flags this PR as
   needing approval, it parks on `waitForEvent` and the dashboard's
   Approve/Reject buttons light up. Click Approve (or type `approve`) —
   `sendEvent(...)` resumes the workflow, and on completion a
   `RemediationWorkflow` starts, polling the PR's real CI to completion
   (no simulated canary/rollout — there's no traffic-splitting
   infrastructure behind a single Worker to fake that against).

4. **Merge or close, for real.** Once you're ready, type `merge this pr`
   or `close this pr` — this calls GitHub's actual merge/close API for
   whichever PR you analyzed in this session (never a number typed fresh,
   even if you ask it to — see `tests/security/workflow-authorization.test.ts`
   for the same scoping rule already applied to approve/reject).

5. **Incident memory.** Type `Investigate the forgeguard incident` —
   pulls any real prior incident out of the shared `EngineeringMemoryStore`
   (empty until step 6 records one).

6. **Live incident.** Type `forgeguard is returning 500s, investigate`.
   Starts a real `IncidentWorkflow`: correlates the symptom against
   engineering memory and produces a confidence-scored root-cause
   hypothesis. forgeguard is honestly medium-criticality (not the old
   demo's fictional high-criticality payment-service), so this
   auto-resolves rather than pausing for rollback approval — the approval
   path still exists in the code (`incident/correlate.ts#rollbackRequiresApproval`)
   for a service that actually is high-criticality.

7. **Teach it something.** Type `Remember that forgeguard uses direct
   deployment`, then later ask `How should we deploy forgeguard?` — the
   answer is grounded in what you just told it (`memory/engineering.ts`,
   verified via `evals/memory`).

8. **MCP server.** `curl -X POST http://localhost:8787/mcp` with a
   `tools/call` JSON-RPC body works from any MCP client, independent of the
   chat session — try `get_incident_history` after step 6 and see the same
   incident recorded.

9. **Voice.** Click the microphone button (Chrome/Edge) and say "Is PR
   number one safe to deploy" instead of typing it.

10. **Productivity.** Open `/productivity` — PR cycle time, CI/deploy
    reliability, and real incident frequency, computed from this repo's
    actual GitHub/incident history (`source: "live"`). A young or
    low-traffic repo will show mostly zero-activity days; that's honest,
    not a bug.

Run `npm run evals` to see the deterministic risk/policy/tool-selection/
memory/remediation checks pass independent of any of the above (these use
fully inline synthetic inputs, not this repo's real data, so they stay
fast and reproducible), and open `/evals` to see the same results
rendered — including run-over-run history if you've run
`npm run evals:record` at least twice. `npm run test:e2e` exercises this
entire script end-to-end against a real browser and real GitHub data for
a fixed reference PR.
