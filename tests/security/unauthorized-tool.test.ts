import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOL_REGISTRY, getToolMetadata } from "../../mcp/tool-metadata";

const serverSource = readFileSync(join(import.meta.dirname, "../../mcp/server.ts"), "utf-8");

const FORBIDDEN_TOOL_NAME_PATTERN = /registerTool\(\s*"(deploy|promote|rollback|restart|delete|write|execute|run_command|shell)/i;

const EXPECTED_MCP_TOOLS = [
  "get_pull_request",
  "get_pull_request_files",
  "get_checks",
  "get_reviews",
  "get_commits",
  "get_diff",
  "search_code",
  "get_deployment",
  "get_incident_history"
];

/**
 * mcp/server.ts is the one place external MCP clients can reach ForgeGuard.
 * This asserts — by reading the actual source, not trusting a comment — that
 * it never registers a write/destructive tool. If someone adds one later,
 * this test fails and forces an explicit decision, per
 * docs/decisions/ADR-005 ("read-only by design").
 */
describe("MCP server exposes read-only tools only", () => {
  it("registers no destructive tool by name", () => {
    expect(serverSource).not.toMatch(FORBIDDEN_TOOL_NAME_PATTERN);
  });

  it("registers exactly the expected read tools", () => {
    const registered = [...serverSource.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
    expect(registered.sort()).toEqual(EXPECTED_MCP_TOOLS.sort());
  });

  it("every registered MCP tool has a matching read-only entry in the tool registry", () => {
    const registered = [...serverSource.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
    for (const name of registered) {
      const metadata = getToolMetadata(name);
      expect(metadata, `${name} is registered in mcp/server.ts but missing from TOOL_REGISTRY`).toBeDefined();
      expect(metadata?.access).toBe("read");
    }
  });

  it("the tool registry itself contains no write tool", () => {
    const writeTools = TOOL_REGISTRY.filter((t) => t.access === "write");
    expect(writeTools).toEqual([]);
  });
});
