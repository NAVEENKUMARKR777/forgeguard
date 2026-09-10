import { DAILY_METRICS } from "./fixtures";
import type { DailyMetricRow, ProductivityBucket, ProductivityGranularity, ProductivityWindow } from "../types/productivity";

/** Rows for one service (or every service, aggregated per day, if `service` is "all") within the last `windowDays`. */
export function rowsInWindow(service: string, windowDays: ProductivityWindow): DailyMetricRow[] {
  const cutoff = new Date(DAILY_METRICS[0]?.date ?? Date.now());
  // windowDays=7 means 7 calendar days total, today included — so the
  // cutoff is windowDays-1 back, not windowDays back (which would be 8
  // inclusive days and quietly overcount every window by one).
  cutoff.setUTCDate(cutoff.getUTCDate() - (windowDays - 1));
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return DAILY_METRICS.filter((row) => row.date >= cutoffStr && (service === "all" || row.service === service));
}

function isoWeekStart(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

/** Buckets rows by day or by ISO week, summing the count-shaped fields. */
export function bucketRows(rows: DailyMetricRow[], granularity: ProductivityGranularity): ProductivityBucket[] {
  const buckets = new Map<string, ProductivityBucket>();

  for (const row of rows) {
    const key = granularity === "daily" ? row.date : isoWeekStart(row.date);
    const bucket = buckets.get(key) ?? { date: key, deployments: 0, incidents: 0, prsMerged: 0 };
    bucket.deployments += row.deployments;
    bucket.incidents += row.incidents;
    bucket.prsMerged += row.prsMerged;
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function sum(rows: DailyMetricRow[], field: keyof DailyMetricRow): number {
  return rows.reduce((total, row) => total + (row[field] as number), 0);
}

export function average(rows: DailyMetricRow[], field: keyof DailyMetricRow): number {
  if (rows.length === 0) return 0;
  return Math.round((sum(rows, field) / rows.length) * 10) / 10;
}
