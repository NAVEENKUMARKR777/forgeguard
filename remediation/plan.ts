import type { PullRequest } from "../mcp/types";
import type { PolicyDecision } from "../policy/engine";

/**
 * Extracted from agents/release-agent.ts#proposeRemediation so it's
 * testable without a live AgentContext — evals/remediation/ exercises it
 * directly. Deterministic by design (ADR-003): the model never generates
 * this list, it only reads it back to the engineer. Policy is read, never
 * written — a plan can *recommend* requesting approval, but only
 * policy/engine.ts's `approvalRequired` decides whether a workflow
 * actually pauses for one.
 */
export function buildRemediationPlan(pr: PullRequest | null, policy: PolicyDecision): string[] {
  const steps: string[] = [];
  const failedChecks = pr?.checks.filter((c) => c.status === "failed") ?? [];
  for (const check of failedChecks) {
    steps.push(`Fix and re-run "${check.name}"${check.detail ? ` (${check.detail})` : ""}`);
  }
  if (pr?.touches_database_migration) {
    steps.push("Deploy the migration separately from the application change, ahead of the release");
  }
  if (policy.approvalRequired) {
    steps.push("Request production approval before promoting past canary");
  }
  steps.push("Deploy via canary and monitor error rate before full rollout");
  return steps;
}
