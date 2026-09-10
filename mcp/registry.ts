export interface ToolDescriptor {
  name: string;
  description: string;
  keywords: string[];
}

/**
 * Deterministic tool-selection heuristic, standing in for model-driven tool
 * choice. Kept rule-based (rather than an LLM call) so it is cheap, fast and
 * exactly reproducible in evals — see evals/tool-selection and
 * docs/decisions/ADR-002-mcp-vs-direct-tools.md.
 */
export const TOOLS: ToolDescriptor[] = [
  {
    name: "get_pull_request",
    description: "Fetch metadata, diff summary and checks for a pull request",
    keywords: ["pr", "pull request", "safe to deploy", "analyze", "review"]
  },
  {
    name: "get_checks",
    description: "Fetch CI check / job results for a pull request",
    keywords: ["failed", "checks", "ci", "tests", "job"]
  },
  {
    name: "get_deployment",
    description: "Fetch deployment status and health for a service",
    keywords: ["deployment", "deploy", "canary", "health", "rollout"]
  },
  {
    name: "get_incident_history",
    description: "Fetch prior incidents recorded for a service",
    keywords: ["incident", "outage", "postmortem", "500s", "down"]
  }
];

/**
 * Leading word-boundary only (no trailing \b) so plurals like "incidents"
 * still match the "incident" keyword, while still rejecting the kind of
 * mid-word collision that made "incidents" match the "ci" keyword.
 */
function containsKeyword(normalized: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}`).test(normalized);
}

export function selectTool(question: string): string | null {
  const normalized = question.toLowerCase();
  let best: { name: string; hits: number } | null = null;
  for (const tool of TOOLS) {
    const hits = tool.keywords.filter((keyword) => containsKeyword(normalized, keyword)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { name: tool.name, hits };
    }
  }
  return best?.name ?? null;
}
