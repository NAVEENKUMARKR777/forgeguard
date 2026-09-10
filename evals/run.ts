import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assessRisk } from "../risk/engine";
import { evaluatePolicy, type PolicyDecision } from "../policy/engine";
import { getProductionPolicy } from "../policy/load-node";
import { selectTool } from "../mcp/registry";
import { getPullRequest } from "../mcp/github";
import { remember, recall } from "../memory/engineering";
import { createFakeSql } from "./memory/fake-sql";
import { correlateIncident, rollbackRequiresApproval } from "../incident/correlate";
import { buildRemediationPlan } from "../remediation/plan";
import type { PullRequest, ServiceMeta } from "../mcp/types";
import type { IncidentRow } from "../memory/incidents";
import type { DriftResult, DriftStatus } from "../types/gitops";
import riskCases from "./risk/cases.json";
import toolCases from "./tool-selection/cases.json";
import policyCases from "./policy/cases.json";
import incidentCases from "./incident/cases.json";
import remediationCases from "./remediation/cases.json";
import regressionBaseline from "./regression/baseline.json";

interface RiskCase {
  name: string;
  pr: PullRequest;
  incidentCount: number;
  expected: { band: string; approvalRequired: boolean };
}

interface ToolCase {
  question: string;
  expected: string;
}

interface PolicyCase {
  name: string;
  pr: PullRequest;
  expected: { approvalRequired: boolean; hasViolation: boolean };
}

interface IncidentCase {
  name: string;
  service: string;
  symptom: string;
  criticality: string;
  hasPriorIncident: boolean;
  matchesFailureMode: boolean;
  driftStatus: DriftStatus;
  expected: { approvalRequired: boolean; minConfidence?: number; maxConfidence?: number };
}

interface RemediationCase {
  name: string;
  pr: PullRequest;
  policy: PolicyDecision;
  expected: { mustContain: string[]; mustNotContain: string[] };
}

interface EvalResult {
  suite: string;
  name: string;
  ok: boolean;
  detail: string;
}

const results: EvalResult[] = [];
let passed = 0;
let failed = 0;

function report(suite: string, name: string, ok: boolean, detail: string): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${suite} :: ${name}${ok ? "" : ` — ${detail}`}`);
  results.push({ suite, name, ok, detail });
  if (ok) passed++;
  else failed++;
}

function syntheticIncidents(count: number, service: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `synthetic-${i}`,
    service,
    cause: "synthetic",
    resolution: "synthetic",
    learned_rule: null,
    created_at: 0
  }));
}

console.log("== risk classification ==");
for (const testCase of riskCases as RiskCase[]) {
  const incidents = syntheticIncidents(testCase.incidentCount, testCase.pr.service);
  const risk = assessRisk({ pr: testCase.pr, service: null, pipeline: null, incidents });
  const policy = evaluatePolicy({ pr: testCase.pr, risk }, getProductionPolicy());
  const ok = risk.band === testCase.expected.band && policy.approvalRequired === testCase.expected.approvalRequired;
  report(
    "risk",
    testCase.name,
    ok,
    `got band=${risk.band} approvalRequired=${policy.approvalRequired} (total=${risk.total})`
  );
}

console.log("\n== tool selection ==");
for (const testCase of toolCases as ToolCase[]) {
  const tool = selectTool(testCase.question);
  const ok = tool === testCase.expected;
  report("tool-selection", testCase.question, ok, `got ${tool ?? "null"}`);
}

console.log("\n== policy enforcement ==");
for (const testCase of policyCases as PolicyCase[]) {
  const risk = assessRisk({ pr: testCase.pr, service: null, pipeline: null, incidents: [] });
  const policy = evaluatePolicy({ pr: testCase.pr, risk }, getProductionPolicy());
  const hasViolation = policy.violations.length > 0;
  const ok = policy.approvalRequired === testCase.expected.approvalRequired && hasViolation === testCase.expected.hasViolation;
  report("policy", testCase.name, ok, `got approvalRequired=${policy.approvalRequired} violations=${JSON.stringify(policy.violations)}`);
}

console.log("\n== memory recall ==");
{
  const sql = createFakeSql();
  remember(sql, "payment-service", "uses canary deployment");
  const facts = recall(sql, "payment-service");
  const ok = facts.some((f) => f.note.includes("canary"));
  report("memory", "remember-then-recall canary fact", ok, `got ${JSON.stringify(facts)}`);

  const unrelated = recall(sql, "checkout-service");
  report("memory", "recall does not leak across services", unrelated.length === 0, `got ${JSON.stringify(unrelated)}`);
}

console.log("\n== incident correlation ==");
for (const testCase of incidentCases as IncidentCase[]) {
  const meta: ServiceMeta = {
    id: testCase.service,
    owner: "eval-owner",
    criticality: testCase.criticality as ServiceMeta["criticality"],
    repository: "eval/repo",
    deployment_strategy: "canary",
    common_failure_modes: testCase.matchesFailureMode ? [testCase.symptom] : ["unrelated-failure-mode-xyz"],
    previous_incidents: []
  };
  const priorIncident: IncidentRow | null = testCase.hasPriorIncident
    ? {
        id: "INC-EVAL",
        service: testCase.service,
        cause: "synthetic prior cause",
        resolution: "synthetic prior resolution",
        learned_rule: null,
        created_at: 0
      }
    : null;
  const drift: DriftResult = { status: testCase.driftStatus, reasons: ["synthetic"] };

  const correlation = correlateIncident({ service: testCase.service, symptom: testCase.symptom, meta, priorIncident, drift });
  const approvalRequired = rollbackRequiresApproval(testCase.criticality, correlation.confidence);

  const confidenceOk =
    (testCase.expected.minConfidence === undefined || correlation.confidence >= testCase.expected.minConfidence) &&
    (testCase.expected.maxConfidence === undefined || correlation.confidence <= testCase.expected.maxConfidence);
  const ok = approvalRequired === testCase.expected.approvalRequired && confidenceOk;
  report(
    "incident",
    testCase.name,
    ok,
    `got confidence=${correlation.confidence} approvalRequired=${approvalRequired} hypothesis="${correlation.hypothesis}"`
  );
}

console.log("\n== remediation planning ==");
for (const testCase of remediationCases as RemediationCase[]) {
  const plan = buildRemediationPlan(testCase.pr, testCase.policy);
  const planText = plan.join(" | ").toLowerCase();
  const containsAll = testCase.expected.mustContain.every((term) => planText.includes(term.toLowerCase()));
  const containsNone = testCase.expected.mustNotContain.every((term) => !planText.includes(term.toLowerCase()));
  const ok = containsAll && containsNone;
  report("remediation", testCase.name, ok, `got plan=${JSON.stringify(plan)}`);
}

console.log("\n== regression (locks real fixture output) ==");
{
  const pr = getPullRequest(regressionBaseline.prNumber);
  if (!pr) {
    report("regression", "pr-1842-fixture-present", false, "fixture missing");
  } else {
    const incidents = syntheticIncidents(regressionBaseline.incidentCount, pr.service);
    const risk = assessRisk({ pr, service: null, pipeline: null, incidents });
    const policy = evaluatePolicy({ pr, risk }, getProductionPolicy());
    const ok =
      risk.total === regressionBaseline.expected.riskTotal &&
      risk.band === regressionBaseline.expected.riskBand &&
      policy.approvalRequired === regressionBaseline.expected.approvalRequired;
    report(
      "regression",
      "pr-1842-matches-baseline",
      ok,
      `got total=${risk.total} band=${risk.band} approvalRequired=${policy.approvalRequired}`
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed`);

const reportPath = fileURLToPath(new URL("../apps/dashboard/public/eval-results.json", import.meta.url));
writeFileSync(
  reportPath,
  JSON.stringify({ ranAt: new Date().toISOString(), passed, failed, results }, null, 2)
);
console.log(`\nWrote ${reportPath}`);

if (failed > 0) process.exit(1);
