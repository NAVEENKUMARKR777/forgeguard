import type { SqlFn } from "../../memory/sql";

/**
 * Minimal in-memory stand-in for a Durable Object's SQLite storage, scoped
 * to exactly the two query shapes memory/engineering.ts issues. Used so
 * evals/run.ts can exercise the real remember()/recall() functions without
 * a live Durable Object (Node has no DO storage) — see docs/decisions/ADR-005.
 */
export function createFakeSql(): SqlFn {
  const rows: Record<string, string | number | boolean | null>[] = [];

  return <T = Record<string, string | number | boolean | null>>(
    strings: TemplateStringsArray,
    ...values: (string | number | boolean | null)[]
  ): T[] => {
    const query = strings.join("?").trim();
    if (query.startsWith("INSERT INTO engineering_memory")) {
      const [id, service, note, created_at] = values;
      rows.push({ id, service, note, created_at });
      return [] as T[];
    }
    if (query.startsWith("SELECT * FROM engineering_memory WHERE service = ?")) {
      const [service] = values;
      return rows
        .filter((r) => r.service === service)
        .sort((a, b) => (b.created_at as number) - (a.created_at as number)) as T[];
    }
    throw new Error(`createFakeSql: unhandled query shape: ${query}`);
  };
}
