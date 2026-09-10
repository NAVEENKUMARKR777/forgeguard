import { describe, expect, it } from "vitest";
import { compareRuns } from "../evals/compare";
import type { EvalRunDetail } from "../evals/history-types";

function run(runId: string, cases: { suite: string; name: string; ok: boolean }[]): EvalRunDetail {
  return {
    runId,
    ranAt: "2026-09-09T00:00:00Z",
    gitCommit: "abc123",
    modelProvider: "workers-ai",
    passed: cases.filter((c) => c.ok).length,
    failed: cases.filter((c) => !c.ok).length,
    cases: cases.map((c) => ({ ...c, detail: "" }))
  };
}

describe("compareRuns", () => {
  it("reports a positive passRateDelta when the run improves", () => {
    const from = run("r1", [
      { suite: "risk", name: "a", ok: true },
      { suite: "risk", name: "b", ok: false }
    ]);
    const to = run("r2", [
      { suite: "risk", name: "a", ok: true },
      { suite: "risk", name: "b", ok: true }
    ]);
    const comparison = compareRuns(from, to);
    expect(comparison.passRateDelta).toBeGreaterThan(0);
    expect(comparison.newlyPassing).toEqual([{ suite: "risk", name: "b" }]);
    expect(comparison.newlyFailing).toEqual([]);
  });

  it("reports newly failing cases as regressions, distinct from newly passing", () => {
    const from = run("r1", [{ suite: "policy", name: "x", ok: true }]);
    const to = run("r2", [{ suite: "policy", name: "x", ok: false }]);
    const comparison = compareRuns(from, to);
    expect(comparison.newlyFailing).toEqual([{ suite: "policy", name: "x" }]);
    expect(comparison.passRateDelta).toBeLessThan(0);
  });

  it("does not count a brand-new case (absent from the earlier run) as a regression or a fix", () => {
    const from = run("r1", [{ suite: "risk", name: "a", ok: true }]);
    const to = run("r2", [
      { suite: "risk", name: "a", ok: true },
      { suite: "incident", name: "new-case", ok: false }
    ]);
    const comparison = compareRuns(from, to);
    expect(comparison.newlyFailing).toEqual([]);
    expect(comparison.newlyPassing).toEqual([]);
  });

  it("computes per-suite before/after totals", () => {
    const from = run("r1", [
      { suite: "risk", name: "a", ok: true },
      { suite: "policy", name: "x", ok: true }
    ]);
    const to = run("r2", [
      { suite: "risk", name: "a", ok: true },
      { suite: "risk", name: "b", ok: true },
      { suite: "policy", name: "x", ok: false }
    ]);
    const comparison = compareRuns(from, to);
    const riskDelta = comparison.suiteDeltas.find((d) => d.suite === "risk")!;
    const policyDelta = comparison.suiteDeltas.find((d) => d.suite === "policy")!;
    expect(riskDelta).toEqual({ suite: "risk", passedBefore: 1, totalBefore: 1, passedAfter: 2, totalAfter: 2 });
    expect(policyDelta).toEqual({ suite: "policy", passedBefore: 1, totalBefore: 1, passedAfter: 0, totalAfter: 1 });
  });

  it("reports zero delta for an identical run compared to itself", () => {
    const a = run("r1", [
      { suite: "risk", name: "a", ok: true },
      { suite: "risk", name: "b", ok: false }
    ]);
    const comparison = compareRuns(a, a);
    expect(comparison.passRateDelta).toBe(0);
    expect(comparison.newlyFailing).toEqual([]);
    expect(comparison.newlyPassing).toEqual([]);
  });
});
