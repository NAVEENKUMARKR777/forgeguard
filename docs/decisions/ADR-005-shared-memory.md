# ADR-005: Shared engineering memory as its own Durable Object, and a real MCP server on top of it

## Status
Accepted — supersedes the per-session incident memory described in ADR-001's "Consequences" section.

## Context
ADR-001 flagged a real gap: incident memory lived inside each chat session's
own `SessionAgent` Durable Object, so it wasn't visible across sessions, and
— once `mcp/server.ts` needed to expose `get_incident_history` to external
MCP clients — wasn't reachable from outside a session's WebSocket connection
at all. A stateless MCP request has no session to read from.

## Decision
`durable-objects/engineering-memory.ts` defines `EngineeringMemoryStore`, a
single well-known Durable Object (id `"global"`, via
`engineeringMemoryStub(env)`) holding `incident_memory` and
`engineering_memory` (free-text "remembered" facts) tables. `SessionAgent`
no longer owns incident data at all — it keeps only its own `audit_log`.
`mcp/server.ts`'s `get_incident_history` tool reads from the same store, so
an incident recorded from one chat session (or from a rolled-back
`IncidentWorkflow`) is visible to every other session and to any external
MCP client immediately. `mcp/server.ts` itself only registers read tools —
enforced by `tests/security/unauthorized-tool.test.ts`, which scans the
actual source rather than trusting a comment.

## Consequences
- Verified working end-to-end during development: a fact remembered in one
  session, an incident recorded by a workflow's rollback, and a `tools/call`
  hitting `/mcp` directly all read/write the same store correctly.
- This is a single global instance — fine for a demo, but a system with many
  independent teams would likely shard by team or account instead of one
  `"global"` id. Not done here; it would be a straightforward change
  (`idFromName(teamId)` instead of `idFromName("global")`).
- `mcp/cloudflare.ts` (real Cloudflare API calls for worker/zone data) is
  deliberately not part of this shared store or the default chat path — it
  needs a real `CLOUDFLARE_API_TOKEN` this environment doesn't have, so it
  stays opt-in and unverified rather than silently wired into a path that
  would then fail for everyone without one.
