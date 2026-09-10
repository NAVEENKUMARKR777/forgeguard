import { estimateTokens } from "./budget";
import type { ContextSource, RankedContextItem } from "./types";

/**
 * Deterministic ranking: priority ascending (lower number = more
 * important, matching ContextSource's doc comment), relevance descending
 * as a tie-breaker. Duplicate `source` names are collapsed to the
 * highest-ranked occurrence — a caller building context twice for the
 * same source (e.g. two callers both adding "policy_decision") shouldn't
 * silently double it up or let a later, lower-quality version win.
 */
export function rankSources(sources: ContextSource[]): RankedContextItem[] {
  const withDefaults = sources.map((s) => ({ ...s, relevance: s.relevance ?? 1 }));
  const sorted = withDefaults.sort((a, b) => a.priority - b.priority || b.relevance - a.relevance);

  const seen = new Set<string>();
  const deduped: typeof sorted = [];
  for (const item of sorted) {
    if (seen.has(item.source)) continue;
    seen.add(item.source);
    deduped.push(item);
  }

  return deduped.map((item) => ({ ...item, tokens: estimateTokens(item.content) }));
}
