# ADR-011: Full GitHub/CI tool surface + a declared tool metadata registry

## Status
Accepted

## Context
The MCP server originally exposed 4 tools. The plan calls out a fuller
GitHub tool surface (`get_pull_request_files`, `get_reviews`,
`get_commits`, `get_diff`, `search_code`) and CI/CD as its own reasoning
chain (PR → pipeline → jobs → tests → artifacts → deployment → health)
rather than one opaque pass/fail. It also calls for every tool to declare
read/write, approval, and risk metadata rather than that being implicit.

## Decision
`mcp/github.ts` and `mcp/cicd.ts` gained the additional functions, backed
by extending the existing `pr-1842.json` fixture (`commits`, `reviews`,
`diff_text` — all optional fields on `PullRequest`, so every other fixture
PR used in evals/tests needed no change). `mcp/server.ts` registers 5 new
MCP tools on top of the original 4. `mcp/tool-metadata.ts` is a declared
registry (`TOOL_REGISTRY`) every tool should appear in, checked by
`tests/security/unauthorized-tool.test.ts` — a tool present in
`mcp/server.ts` but missing from the registry, or registered with
`access: "write"`, fails CI.

## Consequences
- `getArtifacts()` returns `[]` for a known PR and `null` for an unknown
  one — there's no artifact-storage fixture, and returning a fabricated
  artifact list would misrepresent what's actually tracked.
- `search_code` searches changed file *paths* across known PR fixtures
  (there's exactly one PR fixture right now, so the eval/verify:mcp
  coverage of it is thin) — a real GitHub-backed implementation would hit
  the code search API instead; the function signature doesn't need to
  change for that swap.
- No write tool exists anywhere in this codebase. `TOOL_REGISTRY`
  distinguishes `access: "read" | "write"` now specifically so that if one
  is ever added, `tests/security/unauthorized-tool.test.ts`'s "no write
  tool in the registry" check forces someone to consciously update it
  rather than the distinction not existing until it's needed.
