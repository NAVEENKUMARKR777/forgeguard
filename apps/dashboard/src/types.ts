// Mirrors agents/types.ts (SessionState) and the ad-hoc WebSocket message
// shapes agents/session-agent.ts sends. Kept as a hand-maintained duplicate
// rather than a cross-project import — the Worker and this Vite app compile
// under separate tsconfigs (see apps/dashboard/tsconfig.json) with no shared
// build step between them.

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  ts: number;
}

export interface OpenPullRequest {
  number: number;
  title: string;
  author: string;
  headSha: string;
  updatedAt: string;
}

export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskComponent {
  name: string;
  score: number;
  max: number;
  reason: string;
}

export interface RiskAssessment {
  components: RiskComponent[];
  total: number;
  band: RiskBand;
}

export interface PolicyDecision {
  policyName: "production";
  approvalRequired: boolean;
  violations: string[];
  reasons: string[];
}

export interface Investigation {
  prNumber: number;
  risk: RiskAssessment;
  policy: PolicyDecision;
  workflowInstanceId?: string;
  status: "analyzed" | "workflow_running" | "waiting_approval" | "resolved" | "merged" | "closed";
}

export interface PendingApproval {
  instanceId: string;
  kind: "release" | "incident";
}

export interface SessionState {
  messages: ChatMessage[];
  activeInvestigation: Investigation | null;
  pendingApproval: PendingApproval | null;
}

export type StepStatus = string;

export interface PipelineStep {
  name: string;
  status: StepStatus;
  updatedAt: number;
}

export type InboundMessage =
  | { type: "state"; state: SessionState }
  | { type: "cf_agent_state"; state: SessionState }
  | { type: "pipeline_step"; step: string; status: string }
  | { type: "assistant_message"; text: string }
  | { type: string; [key: string]: unknown };

export interface ProductivityBucket {
  date: string;
  deployments: number;
  incidents: number;
  prsMerged: number;
}

export interface ProductivitySnapshot {
  windowDays: number;
  source: "live";
  development: {
    prThroughput: number;
    avgCycleTimeHours: number;
    avgFilesChangedPerPr: number;
    avgCommitsPerPr: number;
  };
  cicd: {
    ciSuccessRate: number;
    deploymentFrequencyPerWeek: number;
    deploymentSuccessRate: number;
    rollbackFrequencyPerWeek: number;
  };
  reliability: {
    incidentFrequencyPerWeek: number;
  };
  buckets: ProductivityBucket[];
}

export interface EvalRunSummary {
  runId: string;
  ranAt: string;
  gitCommit: string | null;
  modelProvider: string;
  passed: number;
  failed: number;
}

export interface SuiteDelta {
  suite: string;
  passedBefore: number;
  totalBefore: number;
  passedAfter: number;
  totalAfter: number;
}

export interface EvalRunComparison {
  from: EvalRunSummary;
  to: EvalRunSummary;
  passRateDelta: number;
  newlyFailing: { suite: string; name: string }[];
  newlyPassing: { suite: string; name: string }[];
  suiteDeltas: SuiteDelta[];
}

export interface EvalCaseResult {
  suite: string;
  name: string;
  ok: boolean;
  detail: string;
}

export interface EvalReport {
  ranAt: string;
  passed: number;
  failed: number;
  results: EvalCaseResult[];
}
