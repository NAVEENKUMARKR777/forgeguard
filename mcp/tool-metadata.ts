export type ToolAccess = "read" | "write";
export type ToolRiskLevel = "low" | "medium" | "high";

export interface ToolMetadata {
  name: string;
  description: string;
  access: ToolAccess;
  approvalRequired: boolean;
  /** Whether calling it twice with the same arguments is safe — true for
   * every tool here since they're all reads; a future write tool
   * (deploy/rollback) would need this false unless backed by an
   * idempotency key like workflows/idempotent-create.ts uses. */
  idempotent: boolean;
  riskLevel: ToolRiskLevel;
}

/**
 * Declared metadata for every tool ForgeGuard exposes, whether through the
 * MCP server (mcp/server.ts) or Code Mode's sandbox
 * (agents/codemode-investigate.ts). This is the source of truth
 * tests/security/tool-escalation.test.ts checks against — a tool missing
 * from this registry, or registered with `access: "write"` and no
 * `approvalRequired`, is a real finding, not a style nit. No write tool
 * exists anywhere in this codebase yet; the registry already distinguishes
 * read/write so adding one later can't accidentally skip the check.
 */
export const TOOL_REGISTRY: ToolMetadata[] = [
  {
    name: "get_pull_request",
    description: "Fetch metadata, diff summary and CI checks for a pull request",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "get_pull_request_files",
    description: "Fetch the changed-file list for a pull request",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "get_checks",
    description: "Fetch CI check/job results for a pull request",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "get_reviews",
    description: "Fetch human code review state for a pull request",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "get_commits",
    description: "Fetch the commit list for a pull request",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "get_diff",
    description: "Fetch the raw diff text for a pull request",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "search_code",
    description: "Search changed file paths across known pull requests",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "get_deployment",
    description: "Fetch service metadata and deployment strategy for a service",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "get_incident_history",
    description: "Fetch prior incidents recorded for a service, from shared engineering memory",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "getPullRequest",
    description: "Code Mode sandbox alias of get_pull_request",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "getService",
    description: "Code Mode sandbox alias of get_deployment's service half",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "getPipeline",
    description: "Code Mode sandbox alias of get_checks",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  },
  {
    name: "getIncidents",
    description: "Code Mode sandbox alias of get_incident_history",
    access: "read",
    approvalRequired: false,
    idempotent: true,
    riskLevel: "low"
  }
];

export function getToolMetadata(name: string): ToolMetadata | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

export function isWriteTool(name: string): boolean {
  return getToolMetadata(name)?.access === "write";
}
