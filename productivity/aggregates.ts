import type { DailyMetricRow, ProductivityBucket, ProductivityGranularity, ProductivityWindow } from "../types/productivity";

/** Rows within the last `windowDays` (today included). */
export function rowsInWindow(rows: DailyMetricRow[], windowDays: ProductivityWindow): DailyMetricRow[] {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (windowDays - 1));
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter((row) => row.date >= cutoffStr);
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

export function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export function perWeek(total: number, windowDays: number): number {
  return Math.round((total / windowDays) * 7 * 10) / 10;
}
