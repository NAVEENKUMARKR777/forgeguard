import { describe, expect, it } from "vitest";
import { detectDrift } from "../../gitops/drift";
import { getGitOpsState } from "../../gitops/state";
import type { GitOpsState } from "../../types/gitops";

describe("detectDrift", () => {
  it("reports in_sync when deployed matches desired", () => {
    const state = getGitOpsState("payment-service", "production")!;
    expect(detectDrift(state).status).toBe("in_sync");
  });

  it("reports deployment_behind when the deployed commit is an earlier commit", () => {
    const state = getGitOpsState("checkout-service", "production")!;
    const result = detectDrift(state);
    expect(result.status).toBe("deployment_behind");
    expect(result.reasons.join(" ")).toMatch(/behind/);
  });

  it("reports deployment_ahead when the deployed commit is a later commit than desired", () => {
    const state = getGitOpsState("identity-service", "production")!;
    const result = detectDrift(state);
    expect(result.status).toBe("deployment_ahead");
    expect(result.reasons.join(" ")).toMatch(/ahead/);
  });

  it("reports reconciliation_failed when deploymentStatus is failed", () => {
    const state = getGitOpsState("notifications-service", "production")!;
    expect(detectDrift(state).status).toBe("reconciliation_failed");
  });

  it("reports unknown rather than guessing when evidence is missing", () => {
    const incomplete: GitOpsState = {
      service: "mystery-service",
      environment: "production",
      commits: [],
      desiredCommit: null,
      deployedCommit: null,
      ciCommit: null,
      deploymentStatus: "unknown",
      healthStatus: "unknown"
    };
    expect(detectDrift(incomplete).status).toBe("unknown");
  });

  it("reports unknown when deployment status itself is unknown, even with commits present", () => {
    const state = getGitOpsState("payment-service", "production")!;
    expect(detectDrift({ ...state, deploymentStatus: "unknown" }).status).toBe("unknown");
  });

  it("tracks drift independently per environment for the same service", () => {
    const production = getGitOpsState("payment-service", "production")!;
    const staging = getGitOpsState("payment-service", "staging")!;
    expect(detectDrift(production).status).toBe("in_sync");
    expect(detectDrift(staging).status).toBe("in_sync");
    expect(production.commits.length).not.toBe(staging.commits.length);
  });

  it("returns null for a service/environment with no recorded state", () => {
    expect(getGitOpsState("nonexistent-service", "production")).toBeNull();
  });
});
