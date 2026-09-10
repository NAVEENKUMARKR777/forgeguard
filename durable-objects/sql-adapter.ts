import type { SqlFn } from "../memory/sql";

/**
 * Adapts a Durable Object's raw `storage.sql.exec()` API to the tagged-
 * template SqlFn shape memory/* expects, so incident/audit/engineering
 * helpers work identically from an Agent (this.sql) and a plain
 * DurableObject (this.ctx.storage.sql). Kept out of memory/sql.ts because
 * `SqlStorage` is a Workers-only global — Node tooling (evals, vitest)
 * compiles memory/* without it.
 */
export function sqlFromStorage(storage: SqlStorage): SqlFn {
  return <T = Record<string, string | number | boolean | null>>(
    strings: TemplateStringsArray,
    ...values: (string | number | boolean | null)[]
  ): T[] => {
    const query = strings.join("?");
    return storage.exec<Record<string, string | number | null>>(query, ...values).toArray() as T[];
  };
}
