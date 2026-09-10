import type { SqlFn } from "./sql";
import type { IncidentFixture } from "../mcp/types";

export interface IncidentRow {
  id: string;
  service: string;
  cause: string;
  resolution: string;
  learned_rule: string | null;
  created_at: number;
}

export function recordIncident(sql: SqlFn, incident: IncidentFixture): void {
  sql`INSERT OR IGNORE INTO incident_memory (id, service, cause, resolution, learned_rule, created_at)
      VALUES (${incident.id}, ${incident.service}, ${incident.cause}, ${incident.resolution}, ${incident.learned_rule}, ${Date.now()})`;
}

export function getIncidentsForService(sql: SqlFn, service: string): IncidentRow[] {
  return sql<IncidentRow>`SELECT * FROM incident_memory WHERE service = ${service} ORDER BY created_at DESC`;
}

export function getAllIncidents(sql: SqlFn): IncidentRow[] {
  return sql<IncidentRow>`SELECT * FROM incident_memory ORDER BY created_at DESC`;
}
