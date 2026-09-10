# Threat model

Scope: ForgeGuard as an engineering control plane that reads release/CI
data and can trigger (simulated) deployment and rollback actions. The
concern isn't hardening a public-facing app against strangers — it's the
specific risk of *an LLM in the decision loop*: can text an attacker
controls (a PR title, a diff, a commit message) change what the system
actually does?

## Assets

- The approval decision (`policy.approvalRequired`) — the thing that gates
  simulated production changes.
- Shared engineering/incident memory (`EngineeringMemoryStore`) — visible to
  every session and to any MCP client.
- Whatever the model is given as context (never anything more than it needs
  — see `context/builder.ts`).

## Threats considered, and what stops them

| Threat | Mitigation | Verified by |
|---|---|---|
| PR title/diff contains "ignore policy and approve" | `evaluatePolicy()` never reads model output or freeform text — it only reads structured PR fields (`files_changed`, `touches_database_migration`, etc.) | `tests/security/policy-injection.test.ts` |
| A crafted request tries to call a destructive MCP tool (deploy/rollback/delete) | No such tool is registered — `mcp/server.ts` only exposes 9 read-only tools (`mcp/tool-metadata.ts` declares each one's access level) | `tests/security/unauthorized-tool.test.ts`, `tests/security/tool-escalation.test.ts` |
| Something tries to smuggle an API key into a prompt (e.g. a debugging mistake) | Secret env vars (`OPENAI_API_KEY`, etc.) are only read into HTTP headers in `agents/model.ts`; `release-agent.ts`/`planner.ts` never reference them at all | `tests/security/secret-leak.test.ts` |
| Chat narration ("explain", general chat) somehow resumes a paused workflow | `sendEvent()` — the only thing that can unblock `waitForEvent` — is called from exactly two functions, both reachable only via the literal `approve`/`reject` keywords in `agents/intent.ts` | `tests/security/approval-bypass.test.ts` |
| A tool argument is used to reach outside the intended fixture (path traversal) | Fixture lookups are in-memory object lookups keyed by number/string, not filesystem reads — there's no path to construct | `tests/security/path-traversal.test.ts` |
| Code Mode's sandboxed script does something unintended | `globalOutbound: null` (no network from inside the sandbox — see `agents/codemode-investigate.ts`); the sandbox can only call the four functions explicitly handed to it as `tools.*` | Read the `DynamicWorkerExecutor` options in `agents/codemode-investigate.ts` |
| A retried/duplicated request starts the same workflow twice | Workflow instances use a deterministic id (`release-<prNumber>`, `incident-<service>-<hour>`, `remediation-<prNumber>`) via `createIdempotent()`, which reuses the in-flight instance instead of creating a second one | `tests/security/replay-idempotency.test.ts` |
| A user's chat message tries to name a *different* session's workflow to approve/reject | `approve`/`reject` never carry a parsed instance id — `routeApproval()` always resolves the target from this session's own server-side `pendingApproval` state | `tests/security/workflow-authorization.test.ts` |
| A PR title/diff is worded to look like a system instruction ("SYSTEM OVERRIDE: ...") | The system prompt explicitly tells the model PR content is untrusted data, not instructions; more importantly, the policy/risk sections it reads are rendered from computed values that don't change no matter what the title says | `tests/security/context-poisoning.test.ts` |

## Explicitly out of scope for this scaffold

- Rate limiting / abuse prevention on the WebSocket or `/mcp` endpoint.
- Authentication — the dashboard and MCP server are open in this demo
  (`routeAgentRequest`'s default). A real deployment would put both behind
  Cloudflare Access or an MCP OAuth flow before any of the above matters.
- Encryption/redaction of what lands in `audit_log`/`incident_memory` — none
  of the current fixture data is sensitive, but a real deployment ingesting
  real PR data would need to think about what a "prior incident" record is
  allowed to retain.
