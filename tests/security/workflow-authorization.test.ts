import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyIntent } from "../../agents/intent";

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf-8");
}

/**
 * "Approve" must always resolve to *this session's own* pending workflow,
 * never to an instance id an attacker could smuggle in through chat text.
 * There are two ways that could go wrong: classifyIntent parsing an id out
 * of the message, or planner.ts trusting anything but server-side session
 * state to pick the target. Both are checked directly here.
 */
describe("approval always targets the session's own pending workflow, never user-supplied text", () => {
  it("classifyIntent's approve/reject intents never carry a user-supplied instance id", () => {
    const approve = classifyIntent("approve workflow release-9999-belonging-to-someone-else");
    const reject = classifyIntent("reject wf-attacker-controlled-id");
    expect(approve).toEqual({ kind: "approve" });
    expect(reject).toEqual({ kind: "reject" });
  });

  it("planner.ts's routeApproval reads the target instance only from session state", () => {
    const source = readSource("../../agents/planner.ts");
    const routeApprovalBody = source.match(/async function routeApproval[\s\S]*?\n}/)?.[0] ?? "";
    expect(routeApprovalBody).toContain("ctx.getState().pendingApproval");
    // It must not derive the instance id from the raw text parameter at all —
    // routeApproval doesn't even take the message text as a parameter.
    expect(routeApprovalBody).toMatch(/routeApproval\(ctx: AgentContext, approved: boolean\)/);
  });

  it("handleApproval and handleIncidentApproval take the instance id as an explicit argument from the caller, not by re-parsing text", () => {
    const releaseSource = readSource("../../agents/release-agent.ts");
    const incidentSource = readSource("../../agents/incident-agent.ts");
    expect(releaseSource).toMatch(/export async function handleApproval\(ctx: AgentContext, instanceId: string, approved: boolean\)/);
    expect(incidentSource).toMatch(/export async function handleIncidentApproval\(ctx: AgentContext, instanceId: string, approved: boolean\)/);
  });
});
