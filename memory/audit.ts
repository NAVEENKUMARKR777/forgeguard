import type { SqlFn } from "./sql";

export interface AuditRow {
  id: string;
  action: string;
  detail: string;
  created_at: number;
}

export function recordAudit(sql: SqlFn, action: string, detail: unknown): void {
  sql`INSERT INTO audit_log (id, action, detail, created_at)
      VALUES (${crypto.randomUUID()}, ${action}, ${JSON.stringify(detail)}, ${Date.now()})`;
}

export function getRecentAudit(sql: SqlFn, limit = 50): AuditRow[] {
  return sql<AuditRow>`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ${limit}`;
}
