/**
 * Matches Agent#sql's signature (agents package) without importing the whole
 * Agent class, so memory/* stays a plain, independently testable module with
 * no Workers-only globals — Node tooling (evals, vitest) compiles it under a
 * separate tsconfig that doesn't have those. The Workers-only adapter that
 * wraps a Durable Object's raw `storage.sql` into this shape lives in
 * durable-objects/sql-adapter.ts instead, precisely to keep this file portable.
 */
export type SqlFn = <T = Record<string, string | number | boolean | null>>(
  strings: TemplateStringsArray,
  ...values: (string | number | boolean | null)[]
) => T[];

export function ensureAuditSchema(sql: SqlFn): void {
  sql`CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`;
}

export function ensureIncidentSchema(sql: SqlFn): void {
  sql`CREATE TABLE IF NOT EXISTS incident_memory (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    cause TEXT NOT NULL,
    resolution TEXT NOT NULL,
    learned_rule TEXT,
    created_at INTEGER NOT NULL
  )`;
}

export function ensureEngineeringSchema(sql: SqlFn): void {
  sql`CREATE TABLE IF NOT EXISTS engineering_memory (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`;
}
