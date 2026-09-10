# ADR-008: React + Vite dashboard, superseding the earlier vanilla-JS choice

## Status
Accepted — reverses the dashboard framework choice made during initial scaffolding.

## Context
The dashboard started as a single static HTML file with inline vanilla JS,
on the reasoning that the proposal's own advice ("don't spend 50% of the
time on UI") outweighed its "React Dashboard" architecture diagram. That
held while the UI was one WebSocket connection and a message list. Once
asked to invest properly in the UI — a risk gauge, a live pipeline
timeline, a policy card, approval controls, and a separate evals view — a
single growing `<script>` block stops being the cheaper option; component
boundaries and real state management earn their cost past a certain size.

## Decision
`apps/dashboard/` is now a React 19 + Vite 8 + Tailwind v4 SPA with two
routes at the time of this decision (`/` chat, `/evals`, via
`react-router-dom`; a third, `/productivity`, was added later by ADR-012),
built to `apps/dashboard/dist/` and served through the existing Workers
Assets binding (`not_found_handling: "single-page-application"` so
client-side routes resolve on a direct load). `useAgentSocket`
(`src/hooks/useAgentSocket.ts`) is the one place that owns the WebSocket
and reconnection; every visual piece (`RiskGauge`, `RiskBreakdown`,
`PolicyCard`, `PipelinePanel`, `ApprovalControls`) is a small component
reading from the state it returns — no component talks to the socket
directly.

`npm run dev` now runs `wrangler dev` and `vite dev` together (via
`concurrently`), with Vite proxying `/agents` and `/mcp` through to the
Worker — real HMR for the frontend without giving up the real backend.
`npm run build:dashboard` produces the static bundle Workers actually
serves; `npm run deploy` runs it automatically via `predeploy`.

## Consequences
- A third `tsconfig.json` (`apps/dashboard/tsconfig.json`, DOM lib + JSX)
  joins the Workers and Node-tooling ones from ADR-001-adjacent scoping
  work — `npm run typecheck` now runs all three.
- Verified with an actual headless browser (Playwright), not just "it
  builds": WebSocket connects, a full analyze → start-workflow →
  wait-for-approval → approve → remediation-workflow cycle renders
  correctly end to end, the evals page renders real data, and zero
  `console.error`/`pageerror` events fired across either run. Screenshots
  from that pass informed some of the final styling.
- The frontend's WebSocket message and state types
  (`apps/dashboard/src/types.ts`) are a hand-maintained mirror of
  `agents/types.ts`, not a shared import — the Worker and the Vite app
  compile under separate tsconfigs with no build-time link between them.
  A protocol change on the backend needs a matching edit here; nothing
  currently enforces that automatically.
