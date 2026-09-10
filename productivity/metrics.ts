import { rowsInWindow, bucketRows, sum, average } from "./aggregates";
import { KNOWN_SERVICES } from "./fixtures";
import type { ProductivitySnapshot, ProductivityWindow } from "../types/productivity";

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function perWeek(total: number, windowDays: number): number {
  return Math.round((total / windowDays) * 7 * 10) / 10;
}

/**
 * The one function that turns raw daily rows into the metrics the plan
 * asks for. Every number here is computed from productivity/fixtures.ts —
 * nothing is a hardcoded "looks plausible" constant. `source: "fixture"`
 * is load-bearing: the React productivity view must never present this as
 * live telemetry (see docs/decisions/ADR-012-productivity-metrics.md).
 */
export function getProductivitySnapshot(service: string, windowDays: ProductivityWindow): ProductivitySnapshot | null {
  if (service !== "all" && !KNOWN_SERVICES.includes(service)) return null;

  const rows = rowsInWindow(service, windowDays);
  const ciRuns = sum(rows, "ciRuns");
  const ciFailures = sum(rows, "ciFailures");
  const deployments = sum(rows, "deployments");
  const deploymentFailures = sum(rows, "deploymentFailures");
  const remediationAttempts = sum(rows, "remediationAttempts");
  const successfulRemediations = sum(rows, "successfulRemediations");

  return {
    service,
    windowDays,
    source: "fixture",
    development: {
      prThroughput: sum(rows, "prsMerged"),
      avgCycleTimeHours: average(rows, "avgCycleHours"),
      avgReviewTimeHours: average(rows, "avgReviewHours"),
      avgFilesChangedPerPr: average(rows, "avgFilesChanged"),
      avgCommitsPerPr: average(rows, "avgCommitsPerPr")
    },
    cicd: {
      ciSuccessRate: ratio(ciRuns - ciFailures, ciRuns),
      deploymentFrequencyPerWeek: perWeek(deployments, windowDays),
      deploymentSuccessRate: ratio(deployments - deploymentFailures, deployments),
      rollbackFrequencyPerWeek: perWeek(sum(rows, "rollbacks"), windowDays)
    },
    ai: {
      agentInvestigations: sum(rows, "agentInvestigations"),
      toolInvocations: sum(rows, "toolInvocations"),
      recommendations: sum(rows, "recommendations"),
      approvalRequests: sum(rows, "approvalRequests"),
      policyDenials: sum(rows, "policyDenials"),
      remediationAttempts,
      successfulRemediations,
      automatedRemediationSuccessRate: ratio(successfulRemediations, remediationAttempts)
    },
    reliability: {
      incidentFrequencyPerWeek: perWeek(sum(rows, "incidents"), windowDays),
      meanTimeToDetectionMinutes: average(rows, "avgDetectionMinutes"),
      meanTimeToRecoveryMinutes: average(rows, "avgRecoveryMinutes")
    },
    buckets: bucketRows(rows, windowDays <= 7 ? "daily" : "weekly")
  };
}

export function listServices(): string[] {
  return KNOWN_SERVICES;
}
