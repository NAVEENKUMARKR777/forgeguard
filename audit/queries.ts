import { getRecentAudit } from "../memory/audit";
import type { SqlFn } from "../memory/sql";
import type { AuditEvent } from "./types";

interface StoredDetail {
  requestId?: string;
  sessionId?: string;
  workflowId?: string;
  toolInvocationId?: string;
  actor?: AuditEvent["actor"];
  detail?: unknown;
}

function parseRow(row: { id: string; action: string; detail: string; created_at: number }): AuditEvent {
  let stored: StoredDetail = {};
  try {
    stored = JSON.parse(row.detail);
  } catch {
    // Older rows (recorded via the plain memory/audit.ts#recordAudit path,
    // before this wrapper existed) won't have the structured shape —
    // surface them with sensible defaults rather than throwing.
  }
  return {
    id: row.id,
    requestId: stored.requestId ?? "",
    sessionId: stored.sessionId,
    workflowId: stored.workflowId,
    toolInvocationId: stored.toolInvocationId,
    actor: stored.actor ?? "system",
    action: row.action,
    detail: stored.detail,
    createdAt: row.created_at
  };
}

/** The full trail for one user interaction — every stage it touched. */
export function getEventsByRequestId(sql: SqlFn, requestId: string, limit = 200): AuditEvent[] {
  return getRecentAudit(sql, limit)
    .map(parseRow)
    .filter((e) => e.requestId === requestId);
}

/** Every audit event tied to a given Workflow instance. */
export function getEventsByWorkflowId(sql: SqlFn, workflowId: string, limit = 200): AuditEvent[] {
  return getRecentAudit(sql, limit)
    .map(parseRow)
    .filter((e) => e.workflowId === workflowId);
}

export function getRecentEvents(sql: SqlFn, limit = 50): AuditEvent[] {
  return getRecentAudit(sql, limit).map(parseRow);
}
