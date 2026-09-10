#!/usr/bin/env node
// Real MCP contract test: starts the actual Worker under `wrangler dev
// --local`, speaks real JSON-RPC to it over HTTP, and asserts on the
// response — not a mock, not a unit test with faked bindings. Exists
// because @cloudflare/vitest-pool-workers (the "proper" way to unit-test
// Workers code with real bindings) currently requires vitest ^4.x, and this
// project is on vitest 5 — see the same TS7/typescript-eslint version-gap
// note in .github/workflows/ci.yml. This script needs no new dependency.
import { spawn } from "node:child_process";

const PORT = 8793;
const BASE = `http://localhost:${PORT}`;

function jsonrpc(method, params) {
  return fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  }).then(async (res) => {
    const text = await res.text();
    const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
    return JSON.parse((dataLine ?? text).replace(/^data: /, ""));
  });
}

async function waitForReady(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("wrangler dev never became ready");
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function killProcessTree(child) {
  // wrangler (via npx) forks its own child processes (Miniflare/workerd);
  // SIGTERM to just the npx process leaves those running. `detached: true`
  // below puts the whole tree in its own process group, so a negative pid
  // targets the group instead of just the one process.
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // already gone
  }
}

async function main() {
  const dev = spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--local"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true
  });
  let devOutput = "";
  dev.stdout.on("data", (d) => (devOutput += d));
  dev.stderr.on("data", (d) => (devOutput += d));

  try {
    await waitForReady();

    const EXPECTED_TOOLS = [
      "get_pull_request",
      "get_pull_request_files",
      "get_checks",
      "get_reviews",
      "get_commits",
      "get_diff",
      "search_code",
      "get_deployment",
      "get_incident_history"
    ].sort();

    const list = await jsonrpc("tools/list", {});
    const toolNames = list.result.tools.map((t) => t.name).sort();
    assert(
      JSON.stringify(toolNames) === JSON.stringify(EXPECTED_TOOLS),
      `tools/list returns exactly the expected tools (got ${JSON.stringify(toolNames)})`
    );

    const call = await jsonrpc("tools/call", { name: "get_pull_request", arguments: { number: 1842 } });
    const text = call.result.content[0].text;
    const pr = JSON.parse(text);
    assert(pr.number === 1842, "tools/call get_pull_request(1842) returns PR #1842");
    assert(pr.service === "payment-service", "returned PR has the expected service field");

    const missing = await jsonrpc("tools/call", { name: "get_pull_request", arguments: { number: 9999 } });
    assert(missing.result.isError === true, "tools/call for an unknown PR number returns isError, not a crash");

    const reviews = await jsonrpc("tools/call", { name: "get_reviews", arguments: { number: 1842 } });
    const reviewList = JSON.parse(reviews.result.content[0].text);
    assert(Array.isArray(reviewList) && reviewList.length > 0, "tools/call get_reviews(1842) returns the fixture review list");

    const search = await jsonrpc("tools/call", { name: "search_code", arguments: { query: "migrations" } });
    const searchResults = JSON.parse(search.result.content[0].text);
    assert(
      searchResults.some((r) => r.path.includes("migrations")),
      "tools/call search_code('migrations') finds the migration file in PR #1842"
    );

    console.log("\nAll MCP contract checks passed.");
  } catch (error) {
    console.error("\n--- wrangler dev output ---\n" + devOutput);
    throw error;
  } finally {
    killProcessTree(dev);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
