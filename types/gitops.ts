export type DeploymentStatus = "succeeded" | "failed" | "in_progress" | "unknown";

export interface GitOpsState {
  service: string;
  /** The commit that should be running — real HEAD of `master`. */
  desiredCommit: string | null;
  /** The commit actually running right now — parsed from the latest real
   * Cloudflare deployment's message annotation (see mcp/cloudflare.ts). */
  deployedCommit: string | null;
  /** The commit CI last validated (may lag desired if CI hasn't run yet). */
  ciCommit: string | null;
  deploymentStatus: DeploymentStatus;
  /** From GitHub's real compare API (deployedCommit...desiredCommit) —
   * how many commits desired is ahead of / behind deployed. Null when
   * either commit is missing or the compare call failed. */
  aheadBy: number | null;
  behindBy: number | null;
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
