import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getPullRequest } from "../../mcp/github";
import { getPipeline } from "../../mcp/cicd";

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf-8");
}

/**
 * Fixture lookups (mcp/github.ts, mcp/cicd.ts) are in-memory object lookups
 * keyed by number, not filesystem reads keyed by user input — there is no
 * path to construct from a tool argument. This is asserted two ways: the
 * lookup functions don't touch the filesystem at request time, and a
 * traversal-shaped id simply misses rather than resolving to anything.
 */
describe("fixture lookups have no path-traversal surface", () => {
  it("mcp/github.ts and mcp/cicd.ts never call fs/readFile at request time", () => {
    for (const file of ["../../mcp/github.ts", "../../mcp/cicd.ts"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/readFile|require\(|node:fs/);
    }
  });

  it("a traversal-shaped or non-numeric id resolves to nothing, not a crash or an unrelated fixture", () => {
    expect(getPullRequest(Number("../../etc/passwd"))).toBeNull(); // NaN
    expect(getPipeline(Number("../../etc/passwd"))).toBeNull();
  });
});
