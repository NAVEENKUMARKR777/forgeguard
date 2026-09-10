import type { DailyMetricRow } from "../types/productivity";

const SERVICES = ["payment-service", "checkout-service", "identity-service", "notifications-service"];
const DAYS = 90;
/** Fixed anchor so regenerating this fixture is stable across runs/environments. */
const ANCHOR = new Date("2026-09-09T00:00:00Z");

/** Small deterministic hash — not cryptographic, just a repeatable way to
 * turn (service, dayIndex) into varied-but-stable numbers. */
function hash(service: string, dayIndex: number): number {
  let h = (dayIndex + 1) * 2654435761;
  for (let i = 0; i < service.length; i++) {
    h = (h ^ service.charCodeAt(i)) * 16777619;
  }
  return Math.abs(h) % 100;
}

/**
 * Deterministic, formula-generated synthetic daily engineering metrics —
 * explicitly synthetic (see `source: "fixture"` on every derived snapshot
 * in productivity/metrics.ts), never claimed as live telemetry anywhere.
 * Generated rather than hand-typed so 90 days × 4 services doesn't become
 * an unreviewable wall of hand-authored JSON, and so the same day always
 * reproduces the same row (no hidden randomness).
 */
export function generateDailyMetrics(): DailyMetricRow[] {
  const rows: DailyMetricRow[] = [];
  for (let dayIndex = 0; dayIndex < DAYS; dayIndex++) {
    const date = new Date(ANCHOR);
    date.setUTCDate(date.getUTCDate() - dayIndex);
    const dateStr = date.toISOString().slice(0, 10);

    for (const service of SERVICES) {
      const seed = hash(service, dayIndex);
      const prsMerged = seed % 4;
      rows.push({
        date: dateStr,
        service,
        deployments: seed % 3,
        deploymentFailures: seed % 11 === 0 ? 1 : 0,
        rollbacks: seed % 23 === 0 ? 1 : 0,
        incidents: seed % 17 === 0 ? 1 : 0,
        avgDetectionMinutes: 5 + (seed % 20),
        avgRecoveryMinutes: 15 + (seed % 60),
        prsOpened: 1 + (seed % 4),
        prsMerged,
        avgCycleHours: 4 + (seed % 30),
        avgReviewHours: 1 + (seed % 8),
        avgFilesChanged: 2 + (seed % 25),
        avgCommitsPerPr: 1 + (seed % 5),
        ciRuns: 2 + (seed % 6),
        ciFailures: seed % 7 === 0 ? 1 : 0,
        agentInvestigations: seed % 5,
        toolInvocations: (seed % 5) * 3,
        recommendations: seed % 3,
        approvalRequests: seed % 4 === 0 ? 1 : 0,
        policyDenials: seed % 13 === 0 ? 1 : 0,
        remediationAttempts: seed % 9 === 0 ? 1 : 0,
        successfulRemediations: seed % 9 === 0 && seed % 2 === 0 ? 1 : 0
      });
    }
  }
  return rows;
}

export const DAILY_METRICS: DailyMetricRow[] = generateDailyMetrics();
export const KNOWN_SERVICES = SERVICES;
