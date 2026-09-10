import { classifyIntent } from "./intent";
import { generateText } from "./model";
import { SYSTEM_PROMPT } from "./prompts";
import { buildContext } from "../context/builder";
import { currentRequestSource, engineeringMemorySource } from "../context/sources";
import { engineeringMemoryStub } from "../durable-objects/engineering-memory";
import { normalizeServiceId } from "./service-aliases";
import * as releaseAgent from "./release-agent";
import * as incidentAgent from "./incident-agent";
import type { AgentContext } from "./types";

/**
 * The explicit multi-stage pipeline from the proposal's section 4: classify
 * intent, then hand off to the specialist agent that owns that kind of
 * request. Kept intentionally thin — all the actual logic lives in
 * release-agent.ts / incident-agent.ts so each stays independently testable.
 */
export async function plan(ctx: AgentContext, text: string): Promise<void> {
  const intent = classifyIntent(text);
  try {
    switch (intent.kind) {
      case "analyze_pr":
        await releaseAgent.analyzeRelease(ctx, intent.prNumber);
        break;
      case "explain":
        releaseAgent.explainAssessment(ctx);
        break;
      case "remediate":
        await releaseAgent.proposeRemediation(ctx);
        break;
      case "start_workflow":
        await releaseAgent.startWorkflow(ctx);
        break;
      case "approve":
        await routeApproval(ctx, true);
        break;
      case "reject":
        await routeApproval(ctx, false);
        break;
      case "investigate_incident":
        await incidentAgent.investigateIncident(ctx, text);
        break;
      case "remember":
        await handleRemember(ctx, intent.service, intent.note);
        break;
      case "general":
        await generalChat(ctx, text);
        break;
    }
  } catch (error) {
    ctx.send(`Something went wrong handling that request: ${(error as Error).message}`);
  }
}

async function routeApproval(ctx: AgentContext, approved: boolean): Promise<void> {
  const pending = ctx.getState().pendingApproval;
  if (!pending) {
    ctx.send("There's nothing currently waiting for approval.");
    return;
  }
  if (pending.kind === "release") {
    await releaseAgent.handleApproval(ctx, pending.instanceId, approved);
  } else {
    await incidentAgent.handleIncidentApproval(ctx, pending.instanceId, approved);
  }
}

async function handleRemember(ctx: AgentContext, serviceHint: string, note: string): Promise<void> {
  const service = normalizeServiceId(serviceHint);
  await engineeringMemoryStub(ctx.env).remember(service, note);
  ctx.send(`Noted: ${service} — ${note}`);
}

async function generalChat(ctx: AgentContext, text: string): Promise<void> {
  const mentionedService = normalizeServiceId(text);
  const facts = await engineeringMemoryStub(ctx.env).recall(mentionedService);

  const built = buildContext([currentRequestSource(text), engineeringMemorySource(facts)], 4000);
  const reply = await generateText(ctx.env, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: built.text }
  ]);
  ctx.send(reply || "I didn't get a response from the model — try rephrasing.");
}
