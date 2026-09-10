export interface DailyMetricRow {
  date: string; // YYYY-MM-DD
  deployments: number;
  deploymentFailures: number;
  rollbacks: number;
  incidents: number;
  prsOpened: number;
  prsMerged: number;
  /** Sum, not average — divide by prsMerged when aggregating across a
   * window, since a single day's "average" is meaningless with 0-1 PRs. */
  cycleHoursSum: number;
  filesChangedSum: number;
  commitsSum: number;
  ciRuns: number;
  ciFailures: number;
}

export type ProductivityWindow = 7 | 30 | 90;
export type ProductivityGranularity = "daily" | "weekly";

export interface ProductivityBucket {
  /** Start date of the bucket (a single day for "daily", a Monday for "weekly"). */
  date: string;
  deployments: number;
  incidents: number;
  prsMerged: number;
}

export interface ProductivitySnapshot {
  windowDays: ProductivityWindow;
  /** Real GitHub PR/Actions history and real incident memory — see
   * productivity/fixtures.ts. A young, low-traffic repo will show mostly
   * zero-activity days; that's honest, not a bug. */
  source: "live";
  development: {
    prThroughput: number;
    avgCycleTimeHours: number;
    avgFilesChangedPerPr: number;
    avgCommitsPerPr: number;
  };
  cicd: {
    ciSuccessRate: number;
    deploymentFrequencyPerWeek: number;
    deploymentSuccessRate: number;
    rollbackFrequencyPerWeek: number;
  };
  reliability: {
    incidentFrequencyPerWeek: number;
  };
  buckets: ProductivityBucket[];
}
