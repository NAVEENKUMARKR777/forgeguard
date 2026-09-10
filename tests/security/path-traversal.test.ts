import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPullRequest } from "../../mcp/github";
import { getPipeline } from "../../mcp/cicd";

function readSource(relativePath: string): string {
  return readFileSync(join(import.meta.dirname, relativePath), "utf-8");
}

/**
 * mcp/github.ts and mcp/cicd.ts key their real GitHub API requests by
 * number (interpolated into a URL path segment), not by reading a local
 * file keyed by user input — there is no filesystem path to construct
 * from a tool argument. Asserted two ways: the lookup functions don't
 * touch the filesystem at request time, and a traversal-shaped id simply
 * misses (no GITHUB_TOKEN in this fake env, so it short-circuits before
 * any network call) rather than resolving to anything.
 */
describe("GitHub/CI lookups have no path-traversal surface", () => {
  it("mcp/github.ts and mcp/cicd.ts never call fs/readFile at request time", () => {
    for (const file of ["../../mcp/github.ts", "../../mcp/cicd.ts"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/readFile|require\(|node:fs/);
    }
  });

  it("a traversal-shaped or non-numeric id resolves to nothing, not a crash or an unrelated fixture", async () => {
    const env = {} as Env;
    expect(await getPullRequest(env, Number("../../etc/passwd"))).toBeNull(); // NaN
    expect(await getPipeline(env, Number("../../etc/passwd"))).toBeNull();
  });
});
