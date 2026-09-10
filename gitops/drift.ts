import type { DriftResult, GitOpsState } from "../types/gitops";

/**
 * Deterministic drift detection — no LLM involvement (this is exactly the
 * kind of fact the release/incident agents need as *evidence*, computed the
 * same way risk/policy are: pure function, always the same answer for the
 * same input). Insufficient evidence produces "unknown" rather than an
 * optimistic guess — see docs/decisions/ADR-009-gitops.md.
 */
export function detectDrift(state: GitOpsState): DriftResult {
  const { desiredCommit, deployedCommit, ciCommit, deploymentStatus, aheadBy, behindBy } = state;

  if (!desiredCommit || !deployedCommit) {
    return {
      status: "unknown",
      reasons: ["insufficient evidence: missing desired or deployed commit"]
    };
  }

  if (deploymentStatus === "failed") {
    return {
      status: "reconciliation_failed",
      reasons: [`deployment status is "failed" for ${state.service}`]
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

  if (aheadBy === null || behindBy === null) {
    return {
      status: "unknown",
      reasons: ["insufficient evidence: could not compare desired and deployed commits"]
    };
  }

  if (behindBy > 0) {
    return {
      status: "deployment_ahead",
      reasons: [
        `deployed commit ${deployedCommit} is ${behindBy} commit(s) ahead of desired commit ${desiredCommit} — likely deployed outside the normal Git flow (hotfix, manual rollback target, etc.)`
      ]
    };
  }

  if (aheadBy > 0) {
    return {
      status: "deployment_behind",
      reasons: [
        `deployed commit ${deployedCommit} is ${aheadBy} commit(s) behind desired commit ${desiredCommit}`,
        ciCommit === desiredCommit
          ? "CI has already validated the desired commit — deployment just hasn't rolled out yet"
          : "CI has not yet validated the desired commit"
      ]
    };
  }

  return {
    status: "unknown",
    reasons: ["desired and deployed commits differ but no ahead/behind distance was reported"]
  };
}
