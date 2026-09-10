export type Intent =
  | { kind: "analyze_pr"; prNumber: number }
  | { kind: "explain" }
  | { kind: "remediate" }
  | { kind: "start_workflow" }
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "investigate_incident" }
  | { kind: "remember"; service: string; note: string }
  | { kind: "general" };

/**
 * Deterministic, keyword-driven classification instead of an LLM call.
 * Cheaper, instant, and exactly reproducible in evals/tool-selection — see
 * docs/decisions/ADR-002-mcp-vs-direct-tools.md for the trade-off.
 */
export function classifyIntent(text: string): Intent {
  const normalized = text.toLowerCase();
  const prMatch = normalized.match(/#?(\d{2,6})/);

  if (/\b(approve)\b/.test(normalized)) return { kind: "approve" };
  if (/\b(reject|deny|decline)\b/.test(normalized)) return { kind: "reject" };

  const rememberMatch = text.match(/\bremember(?:\s+that)?\s+(\S+)\s+(.+)/i);
  if (rememberMatch) {
    return { kind: "remember", service: rememberMatch[1], note: rememberMatch[2] };
  }

  if (/\b(incident|outage|500s|postmortem|down)\b/.test(normalized)) {
    return { kind: "investigate_incident" };
  }

  if (/\b(start|run|kick off|execute)\b.*\b(workflow|remediation|deployment)\b/.test(normalized)) {
    return { kind: "start_workflow" };
  }

  if (/\b(why|reason|explain)\b/.test(normalized)) {
    return { kind: "explain" };
  }

  if (/\b(what should i|remediat|fix|before deploy)\b/.test(normalized)) {
    return { kind: "remediate" };
  }

  if (prMatch && /\b(safe|analyz|review|risk|deploy)\b/.test(normalized)) {
    return { kind: "analyze_pr", prNumber: Number(prMatch[1]) };
  }
  if (prMatch) {
    return { kind: "analyze_pr", prNumber: Number(prMatch[1]) };
  }

  return { kind: "general" };
}
