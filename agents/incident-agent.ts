import { getPullRequest, getService } from "../mcp/github";
import { engineeringMemoryStub } from "../durable-objects/engineering-memory";
import { recordAuditEvent } from "../audit/recorder";
import { getGitOpsState } from "../gitops/state";
import { detectDrift } from "../gitops/drift";
import { createIdempotent } from "../workflows/idempotent-create";
import type { AgentContext } from "./types";

const ACTIVE_SYMPTOM_PATTERN = /\b(500s|down|returning errors|failing|outage|degraded)\b/i;

async function guessService(ctx: AgentContext): Promise<string> {
  const investigation = ctx.getState().activeInvestigation;
  const pr = investigation ? await getPullRequest(ctx.env, investigation.prNumber) : null;
  return pr?.service ?? "forgeguard";
}

/**
 * Handles both "investigate the payment-service incident" (a memory lookup)
 * and "payments are returning 500s" (an active symptom report, which also
 * starts a real IncidentWorkflow — see workflows/incident-workflow.ts and
 * the proposal's "Incident mode").
 */
export async function investigateIncident(ctx: AgentContext, rawText: string): Promise<void> {
  const service = await guessService(ctx);
  const incidents = await engineeringMemoryStub(ctx.env).getIncidentsForService(service);

  if (incidents.length > 0) {
    const lines = incidents.map(
      (i) => `${i.id}: caused by ${i.cause}; resolved by ${i.resolution}. Learned rule: ${i.learned_rule ?? "none recorded"}.`
    );
    ctx.send(`Prior incidents for ${service}:\n${lines.join("\n")}`);
  } else {
    ctx.send(`No prior incidents on record for ${service}.`);
  }

  const gitopsState = await getGitOpsState(ctx.env);
  if (gitopsState) {
    const drift = detectDrift(gitopsState);
    ctx.send(`GitOps state for ${service}: ${drift.status} — ${drift.reasons[0]}`);
  }

  if (ACTIVE_SYMPTOM_PATTERN.test(rawText)) {
    await startIncidentWorkflow(ctx, service, rawText);
  }
}

async function startIncidentWorkflow(ctx: AgentContext, service: string, symptom: string): Promise<void> {
  // Unlike a PR (stable identity forever), an incident is a recurring kind
  // of event — `incident-<service>` alone would wrongly collide with a
  // long-resolved past incident for the same service. Bucketing by hour
  // collapses duplicate reports of the *same* incident (a retried request,
  // someone re-pasting the symptom) without blocking a genuinely new
  // incident that shows up later. (Workflow instance ids reject ":" —
  // hyphen-separated, learned the hard way against a live wrangler dev.)
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const idempotencyKey = `incident-${service}-${hourBucket}`;
  const { instance, reused } = await createIdempotent(ctx.env.INCIDENT_WORKFLOW, idempotencyKey, { service, symptom });
  recordAuditEvent(ctx.sql, {
    requestId: ctx.requestId,
    sessionId: ctx.sessionId,
    workflowId: instance.id,
    actor: "agent",
    action: reused ? "reuse_incident_workflow" : "start_incident_workflow",
    detail: { service }
  });
  ctx.send(
    reused
      ? `Already investigating ${service} (${instance.id}) — reusing that investigation.`
      : `Investigating live — incident workflow ${instance.id} started.`
  );
  await pollIncidentWorkflow(ctx, instance.id, 0, service, true);
}

export async function pollIncidentWorkflow(
  ctx: AgentContext,
  instanceId: string,
  attempt = 0,
  service?: string,
  freshStart = false
): Promise<void> {
  const maxAttempts = 6;
  const instance = await ctx.env.INCIDENT_WORKFLOW.get(instanceId);
  const status = await instance.status();
  ctx.emitStep("incident-workflow", status.status);

  if (status.status === "waiting" || status.status === "paused") {
    markWaitingForRollbackApproval(ctx, instanceId);
    return;
  }
  if (status.status === "complete" || status.status === "errored" || status.status === "terminated") {
    const result = status.output as { hypothesis?: string; confidence?: number; outcome?: string } | null;
    // Same reasoning as ReleaseWorkflow's pollWorkflow (see ADR-020): a
    // genuinely fresh, high-criticality instance can't reach terminal
    // without parking on waitForEvent first, which returns above. Reaching
    // terminal on a `freshStart` chain for a high-criticality service means
    // `reused: false` was a false negative from local dev's Workflows
    // simulator not enforcing unique instance ids (ADR-010) — this is an
    // already-resolved instance from earlier in the dev session.
    const staleReuse = freshStart && service && getService(service)?.criticality === "high";
    recordAuditEvent(ctx.sql, {
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      workflowId: instanceId,
      actor: "system",
      action: "incident_workflow_finished",
      detail: { status: status.status, output: result, staleReuse: staleReuse || undefined }
    });
    // No approval action has occurred in this conversation when staleReuse
    // is true — do not report "Outcome: rolled_back" as if a rollback was
    // just authorized here. The hypothesis is legitimate deterministic
    // analysis, but the outcome describes a different session's approval.
    // See ADR-020.
    if (staleReuse) {
      ctx.send(
        `Rollback not authorized in this conversation: no approval action has occurred here. Workflow ${instanceId} already carried a stored result (status: ${status.status}${result?.hypothesis ? `, hypothesis: ${result.hypothesis}` : ""}) from earlier in this dev session — reused because local dev's Workflows simulator doesn't enforce unique instance ids the way production does. Run \`rm -rf .wrangler/state\` and restart to take this investigation through a fresh correlate → approval → rollback cycle.`
      );
      return;
    }
    if (result?.hypothesis) {
      ctx.send(
        `Root cause hypothesis (${result.confidence}% confidence): ${result.hypothesis}. Outcome: ${result.outcome}.`
      );
    } else {
      ctx.send(`Incident workflow finished with status: ${status.status}.`);
    }
    return;
  }

  if (attempt >= maxAttempts) {
    // Same local-dev status gap as ReleaseWorkflow (see ADR-004): mirror the
    // workflow's own approval rule (high-criticality service) client-side
    // rather than waiting forever on a status string local dev may never report.
    if (service && getService(service)?.criticality === "high") {
      markWaitingForRollbackApproval(ctx, instanceId);
    } else {
      ctx.send("Still investigating — check back shortly.");
    }
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await pollIncidentWorkflow(ctx, instanceId, attempt + 1, service, freshStart);
}

function markWaitingForRollbackApproval(ctx: AgentContext, instanceId: string): void {
  const state = ctx.getState();
  if (state.pendingApproval?.instanceId === instanceId) return;
  ctx.setState({ ...state, pendingApproval: { instanceId, kind: "incident" } });
  ctx.send('Rollback recommended, waiting for approval. Say "approve" or "reject".');
}

export async function handleIncidentApproval(ctx: AgentContext, instanceId: string, approved: boolean): Promise<void> {
  const instance = await ctx.env.INCIDENT_WORKFLOW.get(instanceId);
  await instance.sendEvent({ type: "approval", payload: { approved } });
  recordAuditEvent(ctx.sql, {
    requestId: ctx.requestId,
    sessionId: ctx.sessionId,
    workflowId: instanceId,
    actor: "user",
    action: approved ? "approve_rollback" : "reject_rollback",
    detail: {}
  });
  ctx.setState({ ...ctx.getState(), pendingApproval: null });
  ctx.send(approved ? "Rollback approved." : "Rollback rejected.");
  await pollIncidentWorkflow(ctx, instanceId);
}
