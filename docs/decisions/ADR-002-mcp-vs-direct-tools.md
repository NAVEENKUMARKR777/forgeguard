# ADR-002: Fixture-backed tool modules instead of live MCP servers (for now)

## Status
Accepted, with an explicit follow-on noted below

## Context
The target role calls out MCP servers and agent tool use specifically. The
"maximal" version of this project wires up real GitHub and CI/CD MCP
servers. But a demo that depends on a live GitHub token, a real CI system,
and network access isn't reproducible from a clean clone, and can't be
evaluated deterministically — evals need fixed inputs and expected outputs.

## Decision
`mcp/github.ts` and `mcp/cicd.ts` expose the exact function shapes a real
MCP client would (`getPullRequest`, `getPipeline`, ...), but read from
checked-in fixtures (`fixtures/`) instead of calling out to a real service.
`mcp/registry.ts` also implements a deterministic, keyword-based
`selectTool()` instead of asking the model to choose a tool — this is
intentionally simple and rule-based specifically so it's exactly
reproducible in `evals/tool-selection`.

## Consequences
- The demo is fully offline and deterministic: same fixture in, same risk
  score and policy decision out, every time.
- Swapping in a real MCP client later is a matter of replacing the bodies
  of `getPullRequest`/`getPipeline`/etc. with MCP tool calls — the call
  sites in `agents/release-agent.ts` and `workflows/release-workflow.ts`
  don't need to change, since they already only depend on the function
  signatures in `mcp/types.ts`.
- This is explicitly not "production-ready GitHub integration" and the
  README says so — claiming otherwise would misrepresent what's actually
  wired up.
