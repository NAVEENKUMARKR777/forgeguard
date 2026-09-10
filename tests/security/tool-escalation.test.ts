import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(join(import.meta.dirname, relativePath), "utf-8");
}

/**
 * Every MCP tool declares a Zod inputSchema, so a caller can't smuggle
 * extra fields or call a tool with an arbitrary shape the handler wasn't
 * written for — the MCP server validates against the schema before the
 * handler ever runs. This checks that invariant holds structurally (every
 * registerTool call has an inputSchema) rather than trusting it stays true.
 */
describe("MCP tools cannot be called outside their declared schema", () => {
  it("every registerTool call declares an inputSchema", () => {
    const source = readSource("../../mcp/server.ts");
    const registrations = source.split("server.registerTool(").slice(1);
    expect(registrations.length).toBeGreaterThan(0);
    for (const registration of registrations) {
      const config = registration.slice(0, registration.indexOf("async ("));
      expect(config).toContain("inputSchema");
    }
  });

  it("Code Mode's sandbox tool surface exposes only the four read functions, nothing else", () => {
    const source = readSource("../../agents/codemode-investigate.ts");
    const fnNames = [...source.matchAll(/(\w+):\s*\{\s*execute:/g)].map((m) => m[1]);
    expect(fnNames.sort()).toEqual(["getIncidents", "getPipeline", "getPullRequest", "getService"].sort());
  });
});
