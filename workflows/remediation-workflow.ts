import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { getService } from "../mcp/github";

export interface RemediationWorkflowParams {
  prNumber: number;
  service: string;
}

export interface RemediationWorkflowResult {
  prNumber: number;
  strategy: string;
  outcome: "promoted" | "halted";
  steps: string[];
}

/**
 * The deploy pipeline that runs once a release is approved (or auto-approved).
 * Separate from ReleaseWorkflow (analysis + policy + approval) per
 * docs/decisions/ADR-004 — this is the "actually roll it out" half. Every
 * step here is a deterministic simulation over fixture data, not a real
 * deploy — there is no live infrastructure behind "canary"/"promote". See
 * README's "what's real vs. what's a placeholder" table.
 */
export class RemediationWorkflow extends WorkflowEntrypoint<Env, RemediationWorkflowParams> {
  async run(event: WorkflowEvent<RemediationWorkflowParams>, step: WorkflowStep): Promise<RemediationWorkflowResult> {
    const { prNumber, service } = event.payload;
    const meta = getService(service);
    const strategy = meta?.deployment_strategy ?? "canary";

    await step.do("deploy-canary", async () => ({ strategy, startedAt: Date.now() }));

    // Stand-in for a real bake period (proposal's Scene 4 uses "5 minutes");
    // shortened so the workflow is observable in a local demo.
    await step.sleep("wait-for-canary", "10 seconds");

    const health = await step.do("check-health", async () => ({ healthy: true }));

    if (!health.healthy) {
      return { prNumber, strategy, outcome: "halted", steps: ["deploy-canary", "wait-for-canary", "check-health:unhealthy"] };
    }

    await step.do("promote", async () => ({ promotedAt: Date.now() }));
    await step.do("verify", async () => ({ verified: true }));

    return {
      prNumber,
      strategy,
      outcome: "promoted",
      steps: ["deploy-canary", "wait-for-canary", "check-health", "promote", "verify"]
    };
  }
}
