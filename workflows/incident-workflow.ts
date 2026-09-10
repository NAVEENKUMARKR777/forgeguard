import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { getService } from "../mcp/github";
import { engineeringMemoryStub } from "../durable-objects/engineering-memory";
import { getGitOpsState } from "../gitops/state";
import { detectDrift } from "../gitops/drift";
import { correlateIncident, rollbackRequiresApproval } from "../incident/correlate";

export interface IncidentWorkflowParams {
  service: string;
  symptom: string;
}

interface ApprovalEventPayload {
  approved: boolean;
}

export interface IncidentWorkflowResult {
  service: string;
  hypothesis: string;
  confidence: number;
  approvalRequired: boolean;
  approved: boolean | null;
  outcome: "rolled_back" | "not_rolled_back" | "auto_resolved";
}

/**
 * Investigates a reported incident against engineering memory and
 * (for high-criticality services) pauses for human approval before
 * recommending a rollback — the "Incident mode" from the proposal, kept
 * separate from ReleaseWorkflow since it's triggered by a symptom report,
 * not a PR. Root-cause "confidence" is a small deterministic formula over
 * real inputs (prior incident count, common-failure-mode match), not a
 * fabricated number — see docs/decisions/ADR-005.
 */
export class IncidentWorkflow extends WorkflowEntrypoint<Env, IncidentWorkflowParams> {
  async run(event: WorkflowEvent<IncidentWorkflowParams>, step: WorkflowStep): Promise<IncidentWorkflowResult> {
    const { service, symptom } = event.payload;

    const signals = await step.do("gather-signals", async () => {
      const meta = getService(service);
      const incidents = await engineeringMemoryStub(this.env).getIncidentsForService(service);
      const gitopsState = await getGitOpsState(this.env);
      const drift = gitopsState ? detectDrift(gitopsState) : null;
      return { meta, incidents, drift };
    });

    const correlation = await step.do("correlate", async () => {
      const priorIncident = signals.incidents[0] ?? null;
      const result = correlateIncident({ service, symptom, meta: signals.meta, priorIncident, drift: signals.drift });
      return { ...result, priorIncident };
    });

    const approvalRequired = rollbackRequiresApproval(signals.meta?.criticality, correlation.confidence);

    if (!approvalRequired) {
      return {
        service,
        hypothesis: correlation.hypothesis,
        confidence: correlation.confidence,
        approvalRequired: false,
        approved: null,
        outcome: "auto_resolved"
      };
    }

    const approvalEvent = await step.waitForEvent<ApprovalEventPayload>("await-rollback-approval", {
      type: "approval",
      timeout: "1 hour"
    });

    if (approvalEvent.payload.approved) {
      await step.do("record-outcome", async () => {
        await engineeringMemoryStub(this.env).recordIncident({
          id: `INC-${Date.now()}`,
          service,
          cause: correlation.hypothesis,
          resolution: "rolled back on operator approval",
          affected_service: service,
          learned_rule: symptom
        });
        return { recorded: true };
      });
    }

    return {
      service,
      hypothesis: correlation.hypothesis,
      confidence: correlation.confidence,
      approvalRequired: true,
      approved: approvalEvent.payload.approved,
      outcome: approvalEvent.payload.approved ? "rolled_back" : "not_rolled_back"
    };
  }
}
