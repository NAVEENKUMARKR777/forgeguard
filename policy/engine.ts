import type { ProductionPolicy } from "./schema";
import type { RiskAssessment } from "../risk/engine";
import type { PullRequest } from "../mcp/types";

export interface PolicyDecision {
  policyName: "production";
  approvalRequired: boolean;
  violations: string[];
  reasons: string[];
}

export interface PolicyInput {
  pr: PullRequest;
  risk: RiskAssessment;
}

/**
 * Deterministic policy enforcement. The model may recommend; only this
 * function decides whether human approval is required. See
 * docs/decisions/ADR-003-policy-vs-llm.md. Pure and runtime-agnostic —
 * see policy/load.ts (Workers) and policy/load-node.ts (evals/tests) for
 * how policies.yaml actually gets parsed in each environment.
 */
export function evaluatePolicy(input: PolicyInput, policy: ProductionPolicy): PolicyDecision {
  const violations: string[] = [];
  const reasons: string[] = [];

  if (input.pr.files_changed > policy.max_changed_files) {
    violations.push(
      `changed files (${input.pr.files_changed}) exceed max_changed_files (${policy.max_changed_files})`
    );
  }

  const missingChecks = policy.required_checks.filter((name) => {
    const check = input.pr.checks.find((c) => c.name === name);
    return !check || check.status !== "passed";
  });
  if (missingChecks.length > 0) {
    violations.push(`required checks not passing: ${missingChecks.join(", ")}`);
  }

  const touchedForbiddenPath = input.pr.diff_summary.some((entry) =>
    policy.forbidden_paths.some((pattern) => matchesGlob(entry.path, pattern))
  );
  if (touchedForbiddenPath) {
    violations.push("change touches a path requiring explicit review (forbidden_paths)");
  }

  let approvalRequired = false;
  if (input.risk.total >= policy.approval.required_if_risk_at_least) {
    approvalRequired = true;
    reasons.push(`risk score ${input.risk.total} >= ${policy.approval.required_if_risk_at_least}`);
  }
  if (policy.approval.required_if_database_migration && input.pr.touches_database_migration) {
    approvalRequired = true;
    reasons.push("database migration detected");
  }
  if (policy.approval.required_if_security_change && input.pr.touches_production_config) {
    approvalRequired = true;
    reasons.push("production configuration change detected");
  }
  if (violations.length > 0) {
    approvalRequired = true;
    reasons.push("policy violation(s) present");
  }

  return { policyName: "production", approvalRequired, violations, reasons };
}

function matchesGlob(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}
