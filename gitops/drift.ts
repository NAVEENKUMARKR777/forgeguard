import type { CommitRef, DriftResult, GitOpsState } from "../types/gitops";

function seqOf(commits: CommitRef[], sha: string | null): number | null {
  if (!sha) return null;
  return commits.find((c) => c.sha === sha)?.seq ?? null;
}

/**
 * Deterministic drift detection — no LLM involvement (this is exactly the
 * kind of fact the release/incident agents need as *evidence*, computed the
 * same way risk/policy are: pure function, always the same answer for the
 * same input). Insufficient evidence produces "unknown" rather than an
 * optimistic guess — see docs/decisions/ADR-009-gitops.md.
 */
export function detectDrift(state: GitOpsState): DriftResult {
  const { desiredCommit, deployedCommit, ciCommit, deploymentStatus } = state;

  if (!desiredCommit || !deployedCommit) {
    return {
      status: "unknown",
      reasons: ["insufficient evidence: missing desired or deployed commit"]
    };
  }

  if (deploymentStatus === "failed") {
    return {
      status: "reconciliation_failed",
      reasons: [`deployment status is "failed" for ${state.service} in ${state.environment}`]
    };
  }

  if (deploymentStatus === "unknown") {
    return {
      status: "unknown",
      reasons: ["insufficient evidence: deployment status is unknown"]
    };
  }

  if (desiredCommit === deployedCommit) {
    return {
      status: "in_sync",
      reasons: [`deployed commit ${deployedCommit} matches desired commit`]
    };
  }

  const desiredSeq = seqOf(state.commits, desiredCommit);
  const deployedSeq = seqOf(state.commits, deployedCommit);

  if (desiredSeq === null || deployedSeq === null) {
    return {
      status: "unknown",
      reasons: ["insufficient evidence: desired or deployed commit not found in known commit sequence"]
    };
  }

  if (deployedSeq < desiredSeq) {
    return {
      status: "deployment_behind",
      reasons: [
        `deployed commit ${deployedCommit} (seq ${deployedSeq}) is behind desired commit ${desiredCommit} (seq ${desiredSeq})`,
        ciCommit === desiredCommit
          ? "CI has already validated the desired commit — deployment just hasn't rolled out yet"
          : "CI has not yet validated the desired commit"
      ]
    };
  }

  return {
    status: "deployment_ahead",
    reasons: [
      `deployed commit ${deployedCommit} (seq ${deployedSeq}) is ahead of desired commit ${desiredCommit} (seq ${desiredSeq}) — likely deployed outside the normal Git flow (hotfix, manual rollback target, etc.)`
    ]
  };
}
