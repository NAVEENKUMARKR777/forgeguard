import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(join(import.meta.dirname, relativePath), "utf-8");
}

/**
 * `sendEvent({ type: "approval", ... })` is the only thing that can unblock
 * a workflow parked on `waitForEvent`. These tests assert, from the actual
 * source, that it's reachable only from the two functions gated behind an
 * explicit "approve"/"reject" user intent (agents/intent.ts requires the
 * literal word) — never from analysis, explanation, or general-chat code
 * paths a crafted PR title or diff could otherwise influence.
 */
describe("workflow approval cannot be bypassed by narration paths", () => {
  it("release-agent.ts calls sendEvent only inside handleApproval", () => {
    const source = readSource("../../agents/release-agent.ts");
    assertSendEventOnlyIn(source, "handleApproval");
  });

  it("incident-agent.ts calls sendEvent only inside handleIncidentApproval", () => {
    const source = readSource("../../agents/incident-agent.ts");
    assertSendEventOnlyIn(source, "handleIncidentApproval");
  });

  it("planner.ts calls routeApproval exactly twice, from the approve and reject branches", () => {
    const source = readSource("../../agents/planner.ts");
    const approveBranch = source.match(/case "approve":[\s\S]*?break;/)?.[0] ?? "";
    const rejectBranch = source.match(/case "reject":[\s\S]*?break;/)?.[0] ?? "";
    expect(approveBranch).toContain("routeApproval(ctx, true)");
    expect(rejectBranch).toContain("routeApproval(ctx, false)");
    // Every call site (not the function's own declaration) is one of those two.
    const calls = [...source.matchAll(/routeApproval\(ctx, (true|false)\)/g)];
    expect(calls.length).toBe(2);
  });
});

function assertSendEventOnlyIn(source: string, allowedFunctionName: string): void {
  const functions = [...source.matchAll(/(?:async function|function) (\w+)\([^)]*\)[^{]*\{/g)];
  for (let i = 0; i < functions.length; i++) {
    const name = functions[i][1];
    const start = functions[i].index! + functions[i][0].length;
    const end = i + 1 < functions.length ? functions[i + 1].index! : source.length;
    const body = source.slice(start, end);
    if (body.includes(".sendEvent(")) {
      expect(name).toBe(allowedFunctionName);
    }
  }
}
