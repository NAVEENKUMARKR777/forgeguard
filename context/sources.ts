import type { ContextSource } from "./types";
import type { PullRequest, Pipeline, ServiceMeta } from "../mcp/types";
import type { IncidentRow } from "../memory/incidents";
import type { EngineeringFactRow } from "../memory/engineering";
import type { PolicyDecision } from "../policy/engine";
import type { RiskAssessment } from "../risk/engine";
import type { DriftResult } from "../types/gitops";

/**
 * One factory per context source named in the context-engineering plan.
 * Centralizing them here means release-agent.ts/incident-agent.ts/
 * planner.ts build context out of the same well-tested pieces instead of
 * ad-hoc inline objects — and a ranking/priority change only has to happen
 * in one place.
 */

export function currentRequestSource(text: string): ContextSource {
  return { source: "current_request", priority: 1, content: text };
}

export function pullRequestSource(pr: PullRequest): ContextSource {
  return {
    source: "pull_request",
    priority: 2,
    content: `Title: ${pr.title}\nAuthor: ${pr.author}\nService: ${pr.service}\nFiles changed: ${pr.files_changed}`
  };
}

export function changedFilesSource(pr: PullRequest): ContextSource {
  return {
    source: "changed_files",
    priority: 3,
    content: pr.diff_summary.map((d) => `${d.path} (+${d.additions}/-${d.deletions})`).join("\n") || "No files listed."
  };
}

export function diffSource(pr: PullRequest): ContextSource {
  const touchesSensitive = pr.diff_summary.some((d) => /auth|secret|infrastructure\/production/.test(d.path));
  return {
    source: "diff",
    priority: 3,
    relevance: touchesSensitive ? 1 : 0.6,
    content: touchesSensitive
      ? "Diff touches an auth/secrets/production-infrastructure path — treat as security-sensitive."
      : "Diff does not touch a recognized security-sensitive path."
  };
}

export function failedChecksSource(pr: PullRequest): ContextSource {
  const failed = pr.checks.filter((c) => c.status === "failed");
  return {
    source: "failed_checks",
    priority: 4,
    relevance: failed.length > 0 ? 1 : 0.3,
    content: failed.length
      ? failed.map((c) => `${c.name}: ${c.detail ?? "failed"}`).join("\n")
      : "All checks passing."
  };
}

export function deploymentStateSource(pipeline: Pipeline | null): ContextSource {
  return {
    source: "deployment_state",
    priority: 5,
    content: pipeline
      ? `Strategy: ${pipeline.deployment.strategy}, environment: ${pipeline.deployment.environment}, health: ${pipeline.deployment.health}`
      : "No deployment/pipeline data available."
  };
}

export function gitopsStateSource(drift: DriftResult | null): ContextSource {
  return {
    source: "gitops_state",
    priority: 6,
    relevance: drift && drift.status !== "in_sync" ? 1 : 0.4,
    content: drift ? `${drift.status}: ${drift.reasons.join("; ")}` : "No GitOps state available for this service."
  };
}

export function serviceMetadataSource(service: ServiceMeta | null): ContextSource {
  return {
    source: "service_metadata",
    priority: 7,
    content: service
      ? `Owner: ${service.owner}, criticality: ${service.criticality}, deployment strategy: ${service.deployment_strategy}`
      : "No service metadata available."
  };
}

export function policyDecisionSource(policy: PolicyDecision): ContextSource {
  return {
    source: "policy_decision",
    priority: 2,
    content: `Approval required: ${policy.approvalRequired}\nReasons: ${policy.reasons.join(", ") || "none"}\nViolations: ${policy.violations.join(", ") || "none"}`
  };
}

export function riskAssessmentSource(risk: RiskAssessment): ContextSource {
  return {
    source: "risk_assessment",
    priority: 2,
    content:
      risk.components.map((c) => `${c.name}: ${c.score}/${c.max} (${c.reason})`).join("\n") +
      `\nTotal: ${risk.total}/100 (${risk.band})`
  };
}

export function historicalIncidentsSource(incidents: IncidentRow[]): ContextSource {
  return {
    source: "historical_incidents",
    priority: 8,
    relevance: incidents.length > 0 ? 1 : 0.2,
    content: incidents.length
      ? incidents.map((i) => `${i.id}: ${i.cause} -> ${i.resolution}`).join("\n")
      : "No related incidents on record."
  };
}

export function engineeringMemorySource(facts: EngineeringFactRow[]): ContextSource {
  return {
    source: "engineering_memory",
    priority: 9,
    relevance: facts.length > 0 ? 1 : 0.1,
    content: facts.length ? facts.map((f) => `${f.service}: ${f.note}`).join("\n") : "No remembered facts on record."
  };
}
