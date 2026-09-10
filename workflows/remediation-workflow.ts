import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { getPullRequest } from "../mcp/github";
import type { PullRequestCheck } from "../mcp/types";

export interface RemediationWorkflowParams {
  prNumber: number;
}

export interface RemediationWorkflowResult {
  prNumber: number;
  outcome: "ci_passed" | "ci_failed" | "ci_timed_out";
  checks: PullRequestCheck[];
}

const MAX_POLLS = 10;
const POLL_INTERVAL = "30 seconds";

/**
 * Waits for real CI on the approved PR, then reports real pass/fail — this
 * used to simulate a canary→promote→verify rollout over fixture data
 * (there's no real traffic-splitting infrastructure behind a single
 * Worker to make that real). Merging is a separate, human-triggered
 * decision (see agents/release-agent.ts#mergePullRequest) informed by
 * this result, not gated by it. Durable across the whole wait — real CI
 * can take minutes, which is exactly the case Workflows exist for.
 */
export class RemediationWorkflow extends WorkflowEntrypoint<Env, RemediationWorkflowParams> {
  async run(event: WorkflowEvent<RemediationWorkflowParams>, step: WorkflowStep): Promise<RemediationWorkflowResult> {
    const { prNumber } = event.payload;

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const checks = await step.do(`check-ci-${attempt}`, async () => {
        const pr = await getPullRequest(this.env, prNumber);
        return pr?.checks ?? [];
      });

      const stillPending = checks.length === 0 || checks.some((c) => c.status === "pending");
      if (!stillPending) {
        const anyFailed = checks.some((c) => c.status === "failed");
        return { prNumber, outcome: anyFailed ? "ci_failed" : "ci_passed", checks };
      }

      if (attempt < MAX_POLLS - 1) {
        await step.sleep(`wait-${attempt}`, POLL_INTERVAL);
      }
    }

    return { prNumber, outcome: "ci_timed_out", checks: [] };
  }
}
