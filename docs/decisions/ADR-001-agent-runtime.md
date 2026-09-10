# ADR-001: Agent runtime — Cloudflare Agents SDK on a Durable Object

## Status
Accepted — the "all memory lives in the same DO" consequence below was
superseded by [`ADR-005`](ADR-005-shared-memory.md): incident/engineering
memory moved to its own shared `EngineeringMemoryStore` Durable Object.
Left as originally written otherwise, since it accurately records the
reasoning at the time.

## Context
The assignment needs a stateful conversational surface with persistent
memory and real-time updates to a UI. That rules out a stateless Worker
handling one-shot requests — session state, in-flight investigations, and
audit history all need to survive across messages and reconnects.

## Decision
Use the `agents` SDK's `Agent` base class on a SQLite-backed Durable Object
(`SessionAgent`), one instance per chat session. It gives us, for free:
hibernatable WebSockets, a `state` object that's automatically synced to
connected clients, and `this.sql` for direct SQLite queries against the
agent's own storage — no separate database binding needed for session-scoped
and engineering/incident memory.

## Consequences
- Session identity is just a DO name (`/agents/session-agent/:name`); no
  separate session store.
- All memory in this scaffold (incident history, audit log) lives in the
  same DO as the conversation. That's fine at demo scale; a system serving
  many services/teams would likely split incident memory into its own
  Durable Object or D1 database shared across sessions, since right now
  each session's incident memory is seeded independently rather than shared
  across a whole engineering org. This is a next-phase change, not a
  refactor forced by the current design.
