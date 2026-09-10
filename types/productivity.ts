export interface DailyMetricRow {
  date: string; // YYYY-MM-DD
  service: string;
  deployments: number;
  deploymentFailures: number;
  rollbacks: number;
  incidents: number;
  avgDetectionMinutes: number;
  avgRecoveryMinutes: number;
  prsOpened: number;
  prsMerged: number;
  avgCycleHours: number;
  avgReviewHours: number;
  avgFilesChanged: number;
  avgCommitsPerPr: number;
  ciRuns: number;
  ciFailures: number;
  agentInvestigations: number;
  toolInvocations: number;
  recommendations: number;
  approvalRequests: number;
  policyDenials: number;
  remediationAttempts: number;
  successfulRemediations: number;
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
  service: string;
  windowDays: ProductivityWindow;
  /** Always "fixture" here — see productivity/fixtures.ts. Never presented
   * as live telemetry anywhere in the UI or API. */
  source: "fixture";
  development: {
    prThroughput: number;
    avgCycleTimeHours: number;
    avgReviewTimeHours: number;
    avgFilesChangedPerPr: number;
    avgCommitsPerPr: number;
  };
  cicd: {
    ciSuccessRate: number;
    deploymentFrequencyPerWeek: number;
    deploymentSuccessRate: number;
    rollbackFrequencyPerWeek: number;
  };
  ai: {
    agentInvestigations: number;
    toolInvocations: number;
    recommendations: number;
    approvalRequests: number;
    policyDenials: number;
    remediationAttempts: number;
    successfulRemediations: number;
    automatedRemediationSuccessRate: number;
  };
  reliability: {
    incidentFrequencyPerWeek: number;
    meanTimeToDetectionMinutes: number;
    meanTimeToRecoveryMinutes: number;
  };
  buckets: ProductivityBucket[];
}
