export type ObservabilityEventType =
  | "llm.call"
  | "tool.call"
  | "mcp.call"
  | "workflow.step"
  | "policy.decision"
  | "context.assembled";

export interface ObservabilityEvent {
  event: ObservabilityEventType;
  timestamp: string;
  requestId?: string;
  sessionId?: string;
  durationMs?: number;
  success?: boolean;
  [key: string]: unknown;
}
