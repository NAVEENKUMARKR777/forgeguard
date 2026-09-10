import { recordAudit } from "../memory/audit";
import type { SqlFn } from "../memory/sql";
import type { AuditEventInput } from "./types";

const SECRET_KEY_PATTERN = /token|secret|password|api[-_]?key|authorization|credential/i;
const SECRET_VALUE_PATTERN = /^(sk-|sk-ant-|Bearer\s)/i;

/**
 * Recursively strips anything that looks like a secret before it's
 * persisted — by key name (`apiToken`, `Authorization`, ...) or by value
 * shape (an OpenAI/Anthropic-style key, a bearer token). Defense in depth:
 * nothing in this codebase currently *has* a secret to log (see
 * tests/security/secret-leak.test.ts), but the audit trail is exactly the
 * place a future change could accidentally introduce one, since callers
 * pass it whatever "detail" object they have on hand.
 */
export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_VALUE_PATTERN.test(value) ? "[redacted]" : value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redact(val);
    }
    return out;
  }
  return value;
}

/**
 * Structured, correlated audit recording — a thin wrapper over the
 * existing memory/audit.ts table (no schema change) that adds redaction
 * and a consistent shape (requestId/sessionId/workflowId/actor) so events
 * from one user interaction can be reassembled later. See audit/queries.ts.
 */
export function recordAuditEvent(sql: SqlFn, event: AuditEventInput): void {
  recordAudit(sql, event.action, {
    requestId: event.requestId,
    sessionId: event.sessionId,
    workflowId: event.workflowId,
    toolInvocationId: event.toolInvocationId,
    actor: event.actor,
    detail: redact(event.detail)
  });
}
