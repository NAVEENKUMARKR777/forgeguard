import { describe, expect, it } from "vitest";
import { redact, recordAuditEvent } from "../../audit/recorder";
import { getEventsByRequestId, getEventsByWorkflowId } from "../../audit/queries";
import { ensureAuditSchema } from "../../memory/sql";
import { createFakeAuditSql } from "./fake-audit-sql";

describe("redact", () => {
  it("redacts values by key name regardless of nesting", () => {
    const result = redact({ user: "alice", apiToken: "sk-live-abc123", nested: { Authorization: "Bearer xyz" } }) as any;
    expect(result.user).toBe("alice");
    expect(result.apiToken).toBe("[redacted]");
    expect(result.nested.Authorization).toBe("[redacted]");
  });

  it("redacts values that look like secrets even under an innocuous key", () => {
    const result = redact({ note: "sk-ant-abcdefghijklmnop" }) as any;
    expect(result.note).toBe("[redacted]");
  });

  it("leaves ordinary content untouched", () => {
    const result = redact({ prNumber: 1842, title: "Add retry logic" }) as any;
    expect(result.prNumber).toBe(1842);
    expect(result.title).toBe("Add retry logic");
  });

  it("redacts inside arrays", () => {
    const result = redact([{ password: "hunter2" }, { ok: true }]) as any;
    expect(result[0].password).toBe("[redacted]");
    expect(result[1].ok).toBe(true);
  });
});

describe("recordAuditEvent + queries", () => {
  it("never persists a secret-shaped value, even if a caller passes one", () => {
    const sql = createFakeAuditSql();
    ensureAuditSchema(sql);
    recordAuditEvent(sql, {
      requestId: "req-1",
      actor: "agent",
      action: "test_action",
      detail: { apiToken: "sk-live-shouldnotpersist" }
    });
    const events = getEventsByRequestId(sql, "req-1");
    expect(JSON.stringify(events)).not.toContain("shouldnotpersist");
  });

  it("reassembles every event for one requestId, in one place", () => {
    const sql = createFakeAuditSql();
    ensureAuditSchema(sql);
    recordAuditEvent(sql, { requestId: "req-2", actor: "agent", action: "analyze_pr", detail: { prNumber: 1 } });
    recordAuditEvent(sql, { requestId: "req-2", actor: "user", action: "approve_deployment", detail: {} });
    recordAuditEvent(sql, { requestId: "req-3", actor: "agent", action: "analyze_pr", detail: { prNumber: 2 } });

    const events = getEventsByRequestId(sql, "req-2");
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.action).sort()).toEqual(["analyze_pr", "approve_deployment"]);
  });

  it("filters events by workflowId", () => {
    const sql = createFakeAuditSql();
    ensureAuditSchema(sql);
    recordAuditEvent(sql, { requestId: "req-4", workflowId: "wf-1", actor: "agent", action: "start_workflow", detail: {} });
    recordAuditEvent(sql, { requestId: "req-5", workflowId: "wf-2", actor: "agent", action: "start_workflow", detail: {} });

    const events = getEventsByWorkflowId(sql, "wf-1");
    expect(events).toHaveLength(1);
    expect(events[0].workflowId).toBe("wf-1");
  });
});
