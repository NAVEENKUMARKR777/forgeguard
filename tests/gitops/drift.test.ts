import { describe, expect, it } from "vitest";
import { detectDrift } from "../../gitops/drift";
import type { GitOpsState } from "../../types/gitops";

function state(overrides: Partial<GitOpsState>): GitOpsState {
  return {
    service: "forgeguard",
    desiredCommit: "desired123",
    deployedCommit: "desired123",
    ciCommit: "desired123",
    deploymentStatus: "succeeded",
    aheadBy: null,
    behindBy: null,
    ...overrides
  };
}

/**
 * `detectDrift` is a pure function over `GitOpsState` — these construct
 * that state directly (the way `gitops/state.ts#getGitOpsState` builds it
 * from real GitHub compare-API `ahead_by`/`behind_by` counts) rather than
 * calling the real, network-backed `getGitOpsState`, which needs a live
 * GITHUB_TOKEN and Cloudflare deployment to mean anything — see
 * docs/decisions/ADR-009-gitops.md.
 */
describe("detectDrift", () => {
  it("reports in_sync when deployed matches desired", () => {
    expect(detectDrift(state({})).status).toBe("in_sync");
  });

  it("reports deployment_behind when desired is ahead of deployed", () => {
    const result = detectDrift(
      state({ deployedCommit: "old111", ciCommit: "desired123", aheadBy: 3, behindBy: 0 })
    );
    expect(result.status).toBe("deployment_behind");
    expect(result.reasons.join(" ")).toMatch(/behind/);
  });

  it("reports deployment_ahead when the deployed commit has commits desired lacks", () => {
    const result = detectDrift(
      state({ deployedCommit: "newer999", aheadBy: 0, behindBy: 2 })
    );
    expect(result.status).toBe("deployment_ahead");
    expect(result.reasons.join(" ")).toMatch(/ahead/);
  });

  it("reports reconciliation_failed when deploymentStatus is failed", () => {
    expect(detectDrift(state({ deploymentStatus: "failed" })).status).toBe("reconciliation_failed");
  });

  it("reports unknown rather than guessing when evidence is missing", () => {
    const incomplete = state({ desiredCommit: null, deployedCommit: null, ciCommit: null, deploymentStatus: "unknown" });
    expect(detectDrift(incomplete).status).toBe("unknown");
  });

  it("reports unknown when deployment status itself is unknown, even with commits present", () => {
    expect(detectDrift(state({ deploymentStatus: "unknown" })).status).toBe("unknown");
  });

  it("reports unknown when commits differ but the compare call produced no ahead/behind distance", () => {
    const result = detectDrift(state({ deployedCommit: "old111", aheadBy: null, behindBy: null }));
    expect(result.status).toBe("unknown");
  });
});
