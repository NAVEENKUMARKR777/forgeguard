import type { RiskAssessment } from "../risk/engine";
import type { PolicyDecision } from "../policy/engine";
import type { SqlFn } from "../memory/sql";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  ts: number;
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
  /**
   * Which workflow instance "approve"/"reject" should target. Tracked
   * separately from activeInvestigation because an incident report (e.g.
   * "payments are returning 500s") can start an approval-gated workflow
   * without any PR having been analyzed first.
   */
  pendingApproval: PendingApproval | null;
}

/**
 * Everything release-agent.ts / incident-agent.ts need from the owning
 * SessionAgent, without importing the Durable Object class itself — keeps
 * both modules plain and (mostly) independently testable. `sql` is scoped to
 * this session (audit log); cross-session memory goes through
 * durable-objects/engineering-memory.ts via `env`.
 */
export interface AgentContext {
  env: Env;
  sql: SqlFn;
  /** Correlates every audit event produced while handling one inbound
   * message — see audit/types.ts and audit/queries.ts#getEventsByRequestId. */
  requestId: string;
  sessionId: string;
  getState: () => SessionState;
  setState: (state: SessionState) => void;
  emitStep: (step: string, status: string) => void;
  send: (text: string) => void;
}
