import type { IncidentRow } from "../memory/incidents";
import type { Pipeline, PullRequest, ServiceMeta } from "../mcp/types";
import type { DriftResult, DriftStatus } from "../types/gitops";

export interface RiskInput {
  pr: PullRequest;
  service: ServiceMeta | null;
  pipeline: Pipeline | null;
  incidents: IncidentRow[];
  /** Optional — omitted entirely (not just "unknown") scores 0, so every
   * existing caller/eval that doesn't pass this keeps its exact prior
   * score. See docs/decisions/ADR-009-gitops.md. */
  gitopsDrift?: DriftResult | null;
}

export interface RiskComponent {
  name: string;
  score: number;
  max: number;
  reason: string;
}

export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessment {
  components: RiskComponent[];
  total: number;
  band: RiskBand;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function bandFor(total: number): RiskBand {
  if (total >= 80) return "CRITICAL";
  if (total >= 60) return "HIGH";
  if (total >= 30) return "MEDIUM";
  return "LOW";
}

/**
 * Deterministic, explainable risk scoring. The LLM narrates this assessment
 * (see agents/session-agent.ts#explainWithLlm) but never computes it — see
 * docs/decisions/ADR-003-policy-vs-llm.md for why that split is load-bearing.
 */
export function assessRisk(input: RiskInput): RiskAssessment {
  const components: RiskComponent[] = [];

  const filesChanged = input.pr.files_changed;
  const codeChangeScore = clamp(Math.round((filesChanged / 60) * 20), 0, 20);
  components.push({
    name: "code_change",
    score: codeChangeScore,
    max: 20,
    reason: `${filesChanged} files changed`
  });

  const touchesProdConfig = input.pr.touches_production_config;
  components.push({
    name: "security",
    score: touchesProdConfig ? 18 : 4,
    max: 20,
    reason: touchesProdConfig
      ? "modifies production configuration"
      : "no production configuration changes detected"
  });

  const failedChecks = input.pr.checks.filter((check) => check.status === "failed").length;
  const coverageDelta = input.pr.test_coverage_delta ?? 0;
  const testScore = clamp(failedChecks * 10 + Math.max(0, -coverageDelta), 0, 20);
  components.push({
    name: "test_health",
    score: testScore,
    max: 20,
    reason: `${failedChecks} failing check(s), test coverage delta ${coverageDelta}%`
  });

  const deploymentScore = input.pr.touches_database_migration ? 12 : 2;
  components.push({
    name: "deployment",
    score: deploymentScore,
    max: 15,
    reason: input.pr.touches_database_migration
      ? "includes a database migration"
      : "no schema migration"
  });

  const incidentScore = clamp(input.incidents.length * 8, 0, 15);
  components.push({
    name: "historical_incidents",
    score: incidentScore,
    max: 15,
    reason: `${input.incidents.length} related incident(s) on record for ${input.pr.service}`
  });

  components.push({
    name: "dependency",
    score: 0,
    max: 5,
    reason: "no dependency manifest changes tracked in this scaffold"
  });

  const DRIFT_SCORES: Record<DriftStatus, number> = {
    in_sync: 0,
    deployment_behind: 2,
    unknown: 2,
    deployment_ahead: 4,
    reconciliation_failed: 5
  };
  const gitopsScore = input.gitopsDrift ? DRIFT_SCORES[input.gitopsDrift.status] : 0;
  components.push({
    name: "gitops_drift",
    score: gitopsScore,
    max: 5,
    reason: input.gitopsDrift
      ? (input.gitopsDrift.reasons[0] ?? input.gitopsDrift.status)
      : "no GitOps state available for this service"
  });

  const total = Math.round(components.reduce((sum, component) => sum + component.score, 0));
  return { components, total, band: bandFor(total) };
}
