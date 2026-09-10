export type AuditActor = "user" | "agent" | "system";

export interface AuditEventInput {
  /** Correlates every event from one user interaction — set once per
   * inbound message in session-agent.ts and threaded through AgentContext. */
  requestId: string;
  sessionId?: string;
  workflowId?: string;
  toolInvocationId?: string;
  action: string;
  actor: AuditActor;
  /** Redacted (see audit/recorder.ts#redact) before it's ever persisted. */
  detail: unknown;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  createdAt: number;
}
