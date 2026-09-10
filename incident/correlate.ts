import type { IncidentRow } from "../memory/incidents";
import type { ServiceMeta } from "../mcp/types";
import type { DriftResult } from "../types/gitops";

export interface CorrelationInput {
  service: string;
  symptom: string;
  meta: ServiceMeta | null;
  priorIncident: IncidentRow | null;
  drift: DriftResult | null;
}

export interface CorrelationResult {
  hypothesis: string;
  confidence: number;
}

/**
 * Extracted from workflows/incident-workflow.ts so it's testable without a
 * live Workflows runtime — evals/incident/ exercises this directly. The
 * confidence formula is deterministic and bounded (max 95, never 100 —
 * this is a hypothesis, not a certainty) and built from real signals
 * (prior incident on record, symptom matches a known failure mode,
 * deployment drift present), not a fabricated number.
 */
export function correlateIncident(input: CorrelationInput): CorrelationResult {
  const { service, symptom, meta, priorIncident, drift } = input;
  const matchesFailureMode = meta?.common_failure_modes.some((mode) => symptom.toLowerCase().includes(mode.toLowerCase())) ?? false;
  const hasDeploymentDrift = drift != null && drift.status !== "in_sync";

  let confidence = 40;
  if (priorIncident) confidence += 30;
  if (matchesFailureMode) confidence += 20;
  if (hasDeploymentDrift) confidence += 15;
  confidence = Math.min(confidence, 95);

  const driftNote = hasDeploymentDrift ? ` GitOps shows ${drift!.status} for ${service}.` : "";
  const hypothesis = priorIncident
    ? `Likely repeat of ${priorIncident.id}: ${priorIncident.cause}.${driftNote}`
    : hasDeploymentDrift
      ? `Deployment drift detected (${drift!.status}) — likely cause.${driftNote}`
      : matchesFailureMode
        ? `Matches a known failure mode for ${service}.${driftNote}`
        : `No strong match in engineering memory — needs manual triage.${driftNote}`;

  return { hypothesis, confidence };
}

/** criticality "high" + confidence >= 60 is the same rule
 * workflows/incident-workflow.ts uses to decide whether a rollback needs
 * human sign-off — kept here too so evals can assert on it without
 * duplicating the threshold as a magic number. */
export function rollbackRequiresApproval(criticality: string | undefined, confidence: number): boolean {
  return criticality === "high" && confidence >= 60;
}
