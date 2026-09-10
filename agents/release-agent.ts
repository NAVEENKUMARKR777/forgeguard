import { getService, getPullRequest } from "../mcp/github";
import { mergePullRequest as ghMergePullRequest, closePullRequest as ghClosePullRequest } from "../mcp/github-write";
import { getPipeline } from "../mcp/cicd";
import { assessRisk, type RiskAssessment } from "../risk/engine";
import { evaluatePolicy, type PolicyDecision } from "../policy/engine";
import { getProductionPolicy } from "../policy/load";
import { buildContext } from "../context/builder";
import {
  pullRequestSource,
  changedFilesSource,
  diffSource,
  failedChecksSource,
  deploymentStateSource,
  gitopsStateSource,
  serviceMetadataSource,
  riskAssessmentSource,
  policyDecisionSource,
  historicalIncidentsSource
} from "../context/sources";
import { generateText } from "./model";
import { SYSTEM_PROMPT } from "./prompts";
import { recordAuditEvent } from "../audit/recorder";
import { engineeringMemoryStub } from "../durable-objects/engineering-memory";
import { investigateViaCodeMode } from "./codemode-investigate";
import { getGitOpsState } from "../gitops/state";
import { detectDrift } from "../gitops/drift";
import { createIdempotent } from "../workflows/idempotent-create";
import { buildRemediationPlan } from "../remediation/plan";
import type { AgentContext, Investigation } from "./types";
import type { IncidentRow } from "../memory/incidents";
import type { PullRequest, Pipeline, ServiceMeta } from "../mcp/types";
import type { DriftResult } from "../types/gitops";

async function gatherEvidence(
  env: Env,
  prNumber: number
): Promise<{ pr: PullRequest; service: ServiceMeta | null; pipeline: Pipeline | null; incidents: IncidentRow[] } | null> {
  const viaCodeMode = await investigateViaCodeMode(env, prNumber).catch((error: unknown) => {
    console.warn(`[codemode] investigation threw, falling back to direct calls: ${(error as Error).message}`);
    return null;
  });
  if (viaCodeMode) return viaCodeMode;

  // Direct-call fallback — always available, used whenever Code Mode isn't
  // configured/reachable. See agents/codemode-investigate.ts.
  const pr = await getPullRequest(env, prNumber);
  if (!pr) return null;
  const service = getService(pr.service);
  const pipeline = await getPipeline(env, prNumber);
  const incidents = service ? await engineeringMemoryStub(env).getIncidentsForService(service.id) : [];
  return { pr, service, pipeline, incidents };
}

export async function analyzeRelease(ctx: AgentContext, prNumber: number): Promise<void> {
  ctx.emitStep("fetch-evidence", "running");
  const evidence = await gatherEvidence(ctx.env, prNumber);
  if (!evidence) {
    ctx.emitStep("fetch-evidence", "error");
    ctx.send(`I couldn't find PR #${prNumber} on ${ctx.env.GITHUB_REPO || "the configured repo"}.`);
    return;
  }
  const { pr, service, pipeline, incidents } = evidence;
  ctx.emitStep("fetch-evidence", "done");

  ctx.emitStep("fetch-gitops", "running");
  const gitopsState = await getGitOpsState(ctx.env);
  const gitopsDrift = gitopsState ? detectDrift(gitopsState) : null;
  ctx.emitStep("fetch-gitops", "done");

  ctx.emitStep("risk-analysis", "running");
  const risk = assessRisk({ pr, service, pipeline, incidents, gitopsDrift });
  ctx.emitStep("risk-analysis", "done");

  ctx.emitStep("policy-check", "running");
  const policy = evaluatePolicy({ pr, risk }, getProductionPolicy());
  ctx.emitStep("policy-check", "done");

  const state = ctx.getState();
  ctx.setState({
    ...state,
    activeInvestigation: { prNumber, risk, policy, status: "analyzed" }
  });

  recordAuditEvent(ctx.sql, {
    requestId: ctx.requestId,
    sessionId: ctx.sessionId,
    actor: "agent",
    action: "analyze_pr",
    detail: { prNumber, risk: risk.total, approvalRequired: policy.approvalRequired }
  });

  const explanation = await explainWithLlm(ctx.env, { pr, service, pipeline, incidents, gitopsDrift, risk, policy });
  ctx.send(explanation);
}

export function explainAssessment(ctx: AgentContext): void {
  const investigation = ctx.getState().activeInvestigation;
  if (!investigation) {
    ctx.send("I haven't analyzed a PR yet in this session — ask me to analyze one first.");
    return;
  }
  const { risk, policy } = investigation;
  const componentLines = risk.components
    .filter((c) => c.score > 0)
    .map((c) => `- ${c.name}: ${c.score}/${c.max} — ${c.reason}`)
    .join("\n");
  const approvalLine = policy.approvalRequired
    ? `Approval is required: ${policy.reasons.join("; ")}.`
    : "No approval is required under current policy.";
  ctx.send(
    `PR #${investigation.prNumber} scored ${risk.total}/100 (${risk.band}):\n${componentLines}\n\n${approvalLine}`
  );
}

export async function proposeRemediation(ctx: AgentContext): Promise<void> {
  const investigation = ctx.getState().activeInvestigation;
  if (!investigation) {
    ctx.send("I haven't analyzed a PR yet in this session — ask me to analyze one first.");
    return;
  }
  const pr = await getPullRequest(ctx.env, investigation.prNumber);
  const steps = buildRemediationPlan(pr, investigation.policy);
  ctx.send(`Recommended remediation for PR #${investigation.prNumber}:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
}

export async function startWorkflow(ctx: AgentContext): Promise<void> {
  const investigation = ctx.getState().activeInvestigation;
  if (!investigation) {
    ctx.send("I haven't analyzed a PR yet in this session — ask me to analyze one first.");
    return;
  }
  const idempotencyKey = `release-${investigation.prNumber}`;
  const { instance, reused } = await createIdempotent(ctx.env.RELEASE_WORKFLOW, idempotencyKey, {
    prNumber: investigation.prNumber
  });
  updateInvestigation(ctx, { workflowInstanceId: instance.id, status: "workflow_running" });
  recordAuditEvent(ctx.sql, {
    requestId: ctx.requestId,
    sessionId: ctx.sessionId,
    workflowId: instance.id,
    actor: "agent",
    action: reused ? "reuse_workflow" : "start_workflow",
    detail: { prNumber: investigation.prNumber }
  });
  ctx.send(
    reused
      ? `A release workflow for PR #${investigation.prNumber} is already running (${instance.id}) — resuming it instead of starting a duplicate.`
      : `Started release workflow ${instance.id}. It will pause for approval if policy requires it.`
  );
  await pollWorkflow(ctx, instance.id, 0, true);
}

export async function pollWorkflow(
  ctx: AgentContext,
  instanceId: string,
  attempt = 0,
  freshStart = false
): Promise<void> {
  const maxAttempts = 6;
  const instance = await ctx.env.RELEASE_WORKFLOW.get(instanceId);
  const status = await instance.status();
  ctx.emitStep("workflow", status.status);

  if (status.status === "waiting" || status.status === "paused") {
    markWaitingForApproval(ctx);
    return;
  }
  if (status.status === "complete" || status.status === "errored" || status.status === "terminated") {
    const investigation = ctx.getState().activeInvestigation;
    // A genuinely fresh instance whose policy requires approval cannot reach
    // a terminal state without first parking on waitForEvent — which would
    // have returned above, at the "waiting" branch. Reaching terminal on a
    // `freshStart` chain instead means `createIdempotent()`'s `reused: false`
    // was a false negative: local dev's Workflows simulator doesn't enforce
    // "an existing id throws on create()" the way production does (ADR-010),
    // so this is really an already-resolved instance from earlier in this
    // dev session, not this request's own approval cycle completing. See
    // ADR-020.
    const staleReuse = freshStart && investigation?.policy.approvalRequired === true;
    recordAuditEvent(ctx.sql, {
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      workflowId: instanceId,
      actor: "system",
      action: "workflow_finished",
      detail: { status: status.status, output: status.output, staleReuse: staleReuse || undefined }
    });
    updateInvestigation(ctx, { status: "resolved" });
    // No approval action has occurred in this conversation when staleReuse
    // is true — do not say "approved" or start remediation on the strength
    // of a stored result from a different session. Deployment stays
    // blocked here regardless of what that old result says. See ADR-020.
    if (staleReuse) {
      ctx.send(
        `Deployment blocked here: no approval action has occurred in this conversation. Workflow ${instanceId} already carried a stored result (status: ${status.status}) from earlier in this dev session — reused because local dev's Workflows simulator doesn't enforce unique instance ids the way production does — but that is not the same as approving this deployment now, and remediation will not start from this message. Run \`rm -rf .wrangler/state\` and restart to take this PR through a fresh analyze → policy → approval → remediation cycle.`
      );
      return;
    }
    ctx.send(`Release workflow finished with status: ${status.status}.`);
    if (status.status === "complete") {
      await maybeStartRemediation(ctx, instanceId, status.output);
    }
    return;
  }

  if (attempt >= maxAttempts) {
    // Cloudflare Workflows report "waiting" while parked on waitForEvent in
    // production, but local dev's status API can stay "running" the whole
    // time — fall back to the policy decision we already computed rather
    // than trusting the status string forever. See docs/decisions/ADR-004.
    const investigation = ctx.getState().activeInvestigation;
    if (investigation?.policy.approvalRequired) {
      markWaitingForApproval(ctx);
    } else {
      ctx.send("The release workflow is still running — check back shortly.");
    }
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
  await pollWorkflow(ctx, instanceId, attempt + 1, freshStart);
}

async function maybeStartRemediation(ctx: AgentContext, releaseInstanceId: string, output: unknown): Promise<void> {
  const investigation = ctx.getState().activeInvestigation;
  const result = output as { prNumber?: number; approved?: boolean | null; outcome?: string } | null;
  if (!investigation || !result?.prNumber) return;
  if (result.outcome === "rejected" || result.outcome === "policy_violation") return;

  const { instance, reused } = await createIdempotent(ctx.env.REMEDIATION_WORKFLOW, `remediation-${investigation.prNumber}`, {
    prNumber: investigation.prNumber
  });
  if (reused) return; // already checking — don't re-announce or re-audit a duplicate trigger
  recordAuditEvent(ctx.sql, {
    requestId: ctx.requestId,
    sessionId: ctx.sessionId,
    workflowId: instance.id,
    actor: "agent",
    action: "start_remediation",
    detail: { releaseInstanceId }
  });
  ctx.send(
    `Deployment approved — remediation workflow ${instance.id} is waiting for real CI to finish on this PR. Once it's ready, say "merge this pr" or "close this pr" to decide.`
  );
}

export async function mergePullRequest(ctx: AgentContext): Promise<void> {
  const investigation = ctx.getState().activeInvestigation;
  if (!investigation) {
    ctx.send("I haven't analyzed a PR yet in this session — ask me to analyze one first.");
    return;
  }
  const result = await ghMergePullRequest(ctx.env, investigation.prNumber);
  recordAuditEvent(ctx.sql, {
    requestId: ctx.requestId,
    sessionId: ctx.sessionId,
    actor: "user",
    action: "merge_pull_request",
    detail: { prNumber: investigation.prNumber, ok: result.ok, message: result.message }
  });
  if (result.ok) {
    updateInvestigation(ctx, { status: "merged" });
    ctx.send(`PR #${investigation.prNumber} merged.`);
  } else {
    ctx.send(`Couldn't merge PR #${investigation.prNumber}: ${result.message}`);
  }
}

export async function closePullRequest(ctx: AgentContext): Promise<void> {
  const investigation = ctx.getState().activeInvestigation;
  if (!investigation) {
    ctx.send("I haven't analyzed a PR yet in this session — ask me to analyze one first.");
    return;
  }
  const result = await ghClosePullRequest(ctx.env, investigation.prNumber);
  recordAuditEvent(ctx.sql, {
    requestId: ctx.requestId,
    sessionId: ctx.sessionId,
    actor: "user",
    action: "close_pull_request",
    detail: { prNumber: investigation.prNumber, ok: result.ok, message: result.message }
  });
  if (result.ok) {
    updateInvestigation(ctx, { status: "closed" });
    ctx.send(`PR #${investigation.prNumber} closed.`);
  } else {
    ctx.send(`Couldn't close PR #${investigation.prNumber}: ${result.message}`);
  }
}

function markWaitingForApproval(ctx: AgentContext): void {
  const state = ctx.getState();
  const investigation = state.activeInvestigation;
  if (investigation && investigation.status !== "waiting_approval" && investigation.workflowInstanceId) {
    ctx.setState({
      ...state,
      activeInvestigation: { ...investigation, status: "waiting_approval" },
      pendingApproval: { instanceId: investigation.workflowInstanceId, kind: "release" }
    });
    ctx.send('The release workflow is waiting for human approval. Say "approve" or "reject".');
  }
}

export async function handleApproval(ctx: AgentContext, instanceId: string, approved: boolean): Promise<void> {
  const instance = await ctx.env.RELEASE_WORKFLOW.get(instanceId);
  await instance.sendEvent({ type: "approval", payload: { approved } });
  recordAuditEvent(ctx.sql, {
    requestId: ctx.requestId,
    sessionId: ctx.sessionId,
    workflowId: instanceId,
    actor: "user",
    action: approved ? "approve_deployment" : "reject_deployment",
    detail: {}
  });
  ctx.setState({ ...ctx.getState(), pendingApproval: null });
  ctx.send(approved ? "Approval sent — resuming the workflow." : "Rejection sent — the workflow will stop.");
  await pollWorkflow(ctx, instanceId);
}

function updateInvestigation(ctx: AgentContext, patch: Partial<Investigation>): void {
  const state = ctx.getState();
  if (!state.activeInvestigation) return;
  ctx.setState({ ...state, activeInvestigation: { ...state.activeInvestigation, ...patch } });
}

interface ExplainInput {
  pr: PullRequest;
  service: ServiceMeta | null;
  pipeline: Pipeline | null;
  incidents: IncidentRow[];
  gitopsDrift: DriftResult | null;
  risk: RiskAssessment;
  policy: PolicyDecision;
}

async function explainWithLlm(env: Env, input: ExplainInput): Promise<string> {
  const { pr, service, pipeline, incidents, gitopsDrift, risk, policy } = input;
  const built = buildContext(
    [
      pullRequestSource(pr),
      changedFilesSource(pr),
      diffSource(pr),
      failedChecksSource(pr),
      deploymentStateSource(pipeline),
      gitopsStateSource(gitopsDrift),
      serviceMetadataSource(service),
      riskAssessmentSource(risk),
      policyDecisionSource(policy),
      historicalIncidentsSource(incidents)
    ],
    4000
  );

  try {
    const text = await generateText(env, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Explain this release risk assessment to the engineer:\n\n${built.text}` }
    ]);
    return text || `Risk ${risk.total}/100 (${risk.band}). Approval required: ${policy.approvalRequired}.`;
  } catch (error) {
    return `Risk ${risk.total}/100 (${risk.band}). Approval required: ${policy.approvalRequired}. (Model explanation unavailable: ${(error as Error).message})`;
  }
}
