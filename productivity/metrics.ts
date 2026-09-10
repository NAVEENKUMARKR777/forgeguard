import { fetchDailyMetrics } from "./fixtures";
import { rowsInWindow, bucketRows, sum, ratio, perWeek } from "./aggregates";
import type { ProductivitySnapshot, ProductivityWindow } from "../types/productivity";
import type { IncidentRow } from "../memory/incidents";

/**
 * Turns real daily rows (productivity/fixtures.ts — real GitHub/incident
 * data despite the filename, kept for the existing import path) into the
 * metrics the dashboard renders. `source: "live"` is load-bearing: this
 * must never silently drift back to fabricated numbers — see
 * docs/decisions/ADR-012-productivity-metrics.md.
 */
export async function getProductivitySnapshot(
  env: Env,
  windowDays: ProductivityWindow,
  incidents: IncidentRow[] = []
): Promise<ProductivitySnapshot> {
  const allRows = await fetchDailyMetrics(env, incidents);
  const rows = rowsInWindow(allRows, windowDays);

  const prsMerged = sum(rows, "prsMerged");
  const ciRuns = sum(rows, "ciRuns");
  const ciFailures = sum(rows, "ciFailures");
  const deployments = sum(rows, "deployments");
  const deploymentFailures = sum(rows, "deploymentFailures");

  return {
    windowDays,
    source: "live",
    development: {
      prThroughput: prsMerged,
      avgCycleTimeHours: prsMerged > 0 ? Math.round((sum(rows, "cycleHoursSum") / prsMerged) * 10) / 10 : 0,
      avgFilesChangedPerPr: prsMerged > 0 ? Math.round((sum(rows, "filesChangedSum") / prsMerged) * 10) / 10 : 0,
      avgCommitsPerPr: prsMerged > 0 ? Math.round((sum(rows, "commitsSum") / prsMerged) * 10) / 10 : 0
    },
    cicd: {
      ciSuccessRate: ratio(ciRuns - ciFailures, ciRuns),
      deploymentFrequencyPerWeek: perWeek(deployments, windowDays),
      deploymentSuccessRate: ratio(deployments - deploymentFailures, deployments),
      rollbackFrequencyPerWeek: perWeek(sum(rows, "rollbacks"), windowDays)
    },
    reliability: {
      incidentFrequencyPerWeek: perWeek(sum(rows, "incidents"), windowDays)
    },
    buckets: bucketRows(rows, windowDays <= 7 ? "daily" : "weekly")
  };
}
