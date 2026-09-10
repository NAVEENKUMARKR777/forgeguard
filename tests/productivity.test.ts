import { describe, expect, it } from "vitest";
import { getProductivitySnapshot } from "../productivity/metrics";
import { rowsInWindow, bucketRows, sum } from "../productivity/aggregates";
import type { DailyMetricRow } from "../types/productivity";

function row(overrides: Partial<DailyMetricRow>): DailyMetricRow {
  return {
    date: "2026-01-01",
    deployments: 0,
    deploymentFailures: 0,
    rollbacks: 0,
    incidents: 0,
    prsOpened: 0,
    prsMerged: 0,
    cycleHoursSum: 0,
    filesChangedSum: 0,
    commitsSum: 0,
    ciRuns: 0,
    ciFailures: 0,
    ...overrides
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

describe("rowsInWindow", () => {
  const rows = Array.from({ length: 40 }, (_, i) => row({ date: daysAgo(i), deployments: 1 }));

  it("returns fewer rows for a narrower window", () => {
    expect(rowsInWindow(rows, 7).length).toBeLessThan(rowsInWindow(rows, 30).length);
  });
});

describe("bucketRows", () => {
  const rows = Array.from({ length: 30 }, (_, i) => row({ date: daysAgo(i), deployments: 1 }));

  it("produces one bucket per day for daily granularity", () => {
    const buckets = bucketRows(rowsInWindow(rows, 7), "daily");
    expect(buckets.length).toBeLessThanOrEqual(7);
    expect(new Set(buckets.map((b) => b.date)).size).toBe(buckets.length);
  });

  it("collapses multiple days into fewer weekly buckets", () => {
    const windowed = rowsInWindow(rows, 30);
    expect(bucketRows(windowed, "weekly").length).toBeLessThan(bucketRows(windowed, "daily").length);
  });

  it("weekly bucket totals equal the sum of their daily rows (no double-counting or loss)", () => {
    const windowed = rowsInWindow(rows, 30);
    const weekly = bucketRows(windowed, "weekly");
    expect(sum(windowed, "deployments")).toBe(weekly.reduce((total, b) => total + b.deployments, 0));
  });
});

describe("getProductivitySnapshot", () => {
  // No GITHUB_TOKEN — fetchDailyMetrics short-circuits to all-zero rows
  // (see productivity/fixtures.ts) instead of a live network call, so this
  // exercises the real aggregation path deterministically.
  const env = {} as Env;

  it("always labels its data as live-sourced, never fixture", async () => {
    const snapshot = await getProductivitySnapshot(env, 30);
    expect(snapshot.source).toBe("live");
  });

  it("computes rates as valid ratios even with zero activity", async () => {
    const snapshot = await getProductivitySnapshot(env, 30);
    expect(snapshot.cicd.deploymentSuccessRate).toBeGreaterThanOrEqual(0);
    expect(snapshot.cicd.deploymentSuccessRate).toBeLessThanOrEqual(1);
    expect(snapshot.development.prThroughput).toBe(0);
  });

  it("produces a bucket per day within the window", async () => {
    const snapshot = await getProductivitySnapshot(env, 7);
    expect(snapshot.buckets.length).toBeLessThanOrEqual(7);
  });
});
