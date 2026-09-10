#!/usr/bin/env node
// Runs the real eval suite, then persists the result to D1 via a temporary
// `wrangler dev` instance (same pattern as scripts/verify-mcp-server.mjs).
// `npm run evals` itself stays fast and infra-free — this is the separate,
// explicit "record history" path (see docs/decisions/ADR-015-eval-history.md).
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = 8794;
const BASE = `http://localhost:${PORT}`;
const RESULTS_PATH = fileURLToPath(new URL("../apps/dashboard/public/eval-results.json", import.meta.url));

function gitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null; // not a git repo, or no commits yet — that's fine, not fatal
  }
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

function killProcessTree(child) {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // already gone
  }
}

async function main() {
  console.log("Applying D1 migrations (idempotent — no-op if already applied)...");
  execSync("npx wrangler d1 migrations apply forgeguard-eval-history --local", { stdio: "inherit" });

  console.log("\nRunning evals...");
  execSync("npm run evals", { stdio: "inherit" });

  const report = JSON.parse(readFileSync(RESULTS_PATH, "utf-8"));
  const submission = {
    runId: `run-${Date.now()}`,
    ranAt: report.ranAt,
    gitCommit: gitCommit(),
    modelProvider: process.env.MODEL_PROVIDER ?? "workers-ai",
    results: report.results
  };

  console.log("\nStarting wrangler dev to record this run...");
  const dev = spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--local"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true
  });
  let devOutput = "";
  dev.stdout.on("data", (d) => (devOutput += d));
  dev.stderr.on("data", (d) => (devOutput += d));

  try {
    await waitForReady();

    const recordRes = await fetch(`${BASE}/evals/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission)
    });
    if (!recordRes.ok) throw new Error(`Recording failed: ${recordRes.status} ${await recordRes.text()}`);
    console.log(`Recorded run ${submission.runId} (${submission.results.filter((r) => r.ok).length}/${submission.results.length} passed)`);

    const listRes = await fetch(`${BASE}/evals/runs?limit=2`);
    const { runs } = await listRes.json();

    if (runs.length >= 2) {
      const [latest, previous] = runs;
      const compareRes = await fetch(`${BASE}/evals/compare?from=${previous.runId}&to=${latest.runId}`);
      const comparison = await compareRes.json();
      console.log("\n--- Comparison vs. previous run ---");
      console.log(`Pass rate delta: ${(comparison.passRateDelta * 100).toFixed(1)}%`);
      if (comparison.newlyFailing.length > 0) {
        console.log("Newly failing:", comparison.newlyFailing.map((c) => `${c.suite}::${c.name}`).join(", "));
      }
      if (comparison.newlyPassing.length > 0) {
        console.log("Newly passing:", comparison.newlyPassing.map((c) => `${c.suite}::${c.name}`).join(", "));
      }
      for (const d of comparison.suiteDeltas) {
        if (d.passedBefore !== d.passedAfter || d.totalBefore !== d.totalAfter) {
          console.log(`  ${d.suite}: ${d.passedBefore}/${d.totalBefore} -> ${d.passedAfter}/${d.totalAfter}`);
        }
      }
    } else {
      console.log("\n(This is the first recorded run — nothing to compare against yet.)");
    }
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
