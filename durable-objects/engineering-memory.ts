import { DurableObject } from "cloudflare:workers";
import { ensureEngineeringSchema, ensureIncidentSchema } from "../memory/sql";
import { sqlFromStorage } from "./sql-adapter";
import { getIncidentsForService, getAllIncidents, recordIncident, type IncidentRow } from "../memory/incidents";
import { recall, remember, type EngineeringFactRow } from "../memory/engineering";
import type { IncidentRecord } from "../mcp/types";

/**
 * Cross-session engineering memory: incident history and free-text
 * "remembered" facts about a service. A single well-known instance
 * (id "global") is shared by every SessionAgent and by the MCP server, so
 * an incident recorded from one chat session — or a fact learned from one —
 * is visible everywhere. See docs/decisions/ADR-005-shared-memory.md; this
 * replaces the earlier per-session-only incident memory noted as a gap in
 * ADR-001.
 */
export class EngineeringMemoryStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = sqlFromStorage(ctx.storage.sql);
    ensureIncidentSchema(sql);
    ensureEngineeringSchema(sql);
  }

  recordIncident(incident: IncidentRecord): void {
    recordIncident(sqlFromStorage(this.ctx.storage.sql), incident);
  }

  getIncidentsForService(service: string): IncidentRow[] {
    return getIncidentsForService(sqlFromStorage(this.ctx.storage.sql), service);
  }

  getAllIncidents(): IncidentRow[] {
    return getAllIncidents(sqlFromStorage(this.ctx.storage.sql));
  }

  remember(service: string, note: string): void {
    remember(sqlFromStorage(this.ctx.storage.sql), service, note);
  }

  recall(service: string): EngineeringFactRow[] {
    return recall(sqlFromStorage(this.ctx.storage.sql), service);
  }
}

export function engineeringMemoryStub(env: Env) {
  const id = env.ENGINEERING_MEMORY.idFromName("global");
  return env.ENGINEERING_MEMORY.get(id);
}
