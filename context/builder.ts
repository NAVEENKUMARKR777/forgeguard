import { estimateTokens, enforceBudget } from "./budget";
import { rankSources } from "./ranking";
import { emit } from "../observability/logger";
import type { BuiltContext, ContextSource } from "./types";

export type { ContextSource, BuiltContext } from "./types";

/**
 * Ranks context sources (context/ranking.ts), enforces a hard token budget
 * (context/budget.ts), and renders what survives into one prompt-ready
 * string. See docs/decisions ("context engineering") for why this lives
 * outside the prompt string instead of just concatenating everything, and
 * context/sources.ts for the reusable per-domain source builders that feed
 * this.
 */
export function buildContext(sources: ContextSource[], tokenBudget: number): BuiltContext {
  const ranked = rankSources(sources);
  const { included, dropped } = enforceBudget(ranked, tokenBudget);

  const text = included.map((item) => `## ${item.source}\n${item.content}`).join("\n\n");

  emit({
    event: "context.assembled",
    tokenBudget,
    includedCount: included.length,
    droppedCount: dropped.length,
    estimatedTokens: estimateTokens(text),
    droppedSources: dropped.map((i) => i.source)
  });

  return {
    text,
    includedSections: included.map((i) => i.source),
    droppedSections: dropped.map((i) => i.source),
    estimatedTokens: estimateTokens(text),
    items: [
      ...included.map((i) => ({ source: i.source, priority: i.priority, relevance: i.relevance, tokens: i.tokens, included: true })),
      ...dropped.map((i) => ({ source: i.source, priority: i.priority, relevance: i.relevance, tokens: i.tokens, included: false }))
    ]
  };
}
