export interface CommitRef {
  sha: string;
  /** Position in the branch's commit sequence — synthetic ordinal, not a
   * timestamp, since fixtures have no real git history to derive order
   * from. Real commit ancestry (`git merge-base --is-ancestor`) would
   * replace this in a live-GitHub mode. */
  seq: number;
}

export type DeploymentStatus = "succeeded" | "failed" | "in_progress" | "unknown";
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface GitOpsState {
  service: string;
  environment: string;
  commits: CommitRef[];
  /** The commit that should be running — typically the PR's target branch HEAD. */
  desiredCommit: string | null;
  /** The commit actually running in this environment right now. */
  deployedCommit: string | null;
  /** The commit CI last validated (may lag desired if CI hasn't run yet). */
  ciCommit: string | null;
  deploymentStatus: DeploymentStatus;
  healthStatus: HealthStatus;
}

export type DriftStatus =
  | "in_sync"
  | "deployment_behind"
  | "deployment_ahead"
  | "reconciliation_failed"
  | "unknown";

export interface DriftResult {
  status: DriftStatus;
  reasons: string[];
}
