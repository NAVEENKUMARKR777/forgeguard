import type { SqlFn } from "../../memory/sql";

/** In-memory stand-in for a Durable Object's SQLite storage, scoped to
 * exactly the query shapes memory/audit.ts issues — see
 * evals/memory/fake-sql.ts for the same pattern applied to engineering memory. */
export function createFakeAuditSql(): SqlFn {
  const rows: Record<string, string | number | boolean | null>[] = [];

  return <T = Record<string, string | number | boolean | null>>(
    strings: TemplateStringsArray,
    ...values: (string | number | boolean | null)[]
  ): T[] => {
    const query = strings.join("?").trim();
    if (query.startsWith("CREATE TABLE")) return [] as T[];
    if (query.startsWith("INSERT INTO audit_log")) {
      const [id, action, detail, created_at] = values;
      rows.push({ id, action, detail, created_at });
      return [] as T[];
    }
    if (query.startsWith("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?")) {
      const [limit] = values as [number];
      return [...rows].sort((a, b) => (b.created_at as number) - (a.created_at as number)).slice(0, limit) as T[];
    }
    throw new Error(`createFakeAuditSql: unhandled query shape: ${query}`);
  };
}
