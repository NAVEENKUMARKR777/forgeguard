import type { SqlFn } from "./sql";

export interface EngineeringFactRow {
  id: string;
  service: string;
  note: string;
  created_at: number;
}

/** A free-text fact remembered about a service — "payments uses canary deployment". */
export function remember(sql: SqlFn, service: string, note: string): void {
  sql`INSERT INTO engineering_memory (id, service, note, created_at)
      VALUES (${crypto.randomUUID()}, ${service}, ${note}, ${Date.now()})`;
}

export function recall(sql: SqlFn, service: string): EngineeringFactRow[] {
  return sql<EngineeringFactRow>`SELECT * FROM engineering_memory WHERE service = ${service} ORDER BY created_at DESC`;
}
