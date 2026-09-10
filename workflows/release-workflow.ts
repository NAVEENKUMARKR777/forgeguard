import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { getService, getPullRequest } from "../mcp/github";
import { getPipeline } from "../mcp/cicd";
import { assessRisk } from "../risk/engine";
import { evaluatePolicy } from "../policy/engine";
import { getProductionPolicy } from "../policy/load";

export interface ReleaseWorkflowParams {
  prNumber: number;
}

export interface ReleaseWorkflowResult {
  prNumber: number;
  riskTotal: number;
  riskBand: string;
  approvalRequired: boolean;
  approvalReasons: string[];
  approved: boolean | null;
  outcome: "auto_approved" | "approved" | "rejected" | "policy_violation";
}

interface ApprovalEventPayload {
  approved: boolean;
}

/**
 * Durable, multi-step release orchestration. Survives Worker restarts and
 * Durable Object eviction between steps because Cloudflare Workflows persist
 * step results independently of any single request. See
 * docs/decisions/ADR-004-durable-workflow.md.
 */
export class ReleaseWorkflow extends WorkflowEntrypoint<Env, ReleaseWorkflowParams> {
  async run(event: WorkflowEvent<ReleaseWorkflowParams>, step: WorkflowStep): Promise<ReleaseWorkflowResult> {
    const { prNumber } = event.payload;

    const evidence = await step.do("gather-evidence", async () => {
      const pr = await getPullRequest(this.env, prNumber);
      if (!pr) {
        throw new Error(`No data for PR #${prNumber} on ${this.env.GITHUB_REPO || "the configured repo"}`);
      }
      const service = getService(this.env, pr.service);
      const pipeline = await getPipeline(this.env, prNumber);
      return { pr, service, pipeline };
    });

    const assessment = await step.do("assess-risk", async () => {
      return assessRisk({
        pr: evidence.pr,
        service: evidence.service,
        pipeline: evidence.pipeline,
        incidents: []
      });
    });

    const decision = await step.do("evaluate-policy", async () => {
      return evaluatePolicy({ pr: evidence.pr, risk: assessment }, getProductionPolicy());
    });

    if (decision.violations.length > 0 && decision.approvalRequired === false) {
      return {
        prNumber,
        riskTotal: assessment.total,
        riskBand: assessment.band,
        approvalRequired: true,
        approvalReasons: decision.violations,
        approved: false,
        outcome: "policy_violation"
      };
    }

    if (!decision.approvalRequired) {
      return {
        prNumber,
        riskTotal: assessment.total,
        riskBand: assessment.band,
        approvalRequired: false,
        approvalReasons: [],
        approved: null,
        outcome: "auto_approved"
      };
    }

    const approvalEvent = await step.waitForEvent<ApprovalEventPayload>("await-approval", {
      type: "approval",
      timeout: "1 hour"
    });

    return {
      prNumber,
      riskTotal: assessment.total,
      riskBand: assessment.band,
      approvalRequired: true,
      approvalReasons: decision.reasons,
      approved: approvalEvent.payload.approved,
      outcome: approvalEvent.payload.approved ? "approved" : "rejected"
    };
  }
}
