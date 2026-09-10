import type { RankedContextItem } from "./types";

/** ~4 chars/token, adequate for budgeting decisions, not for billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface BudgetResult {
  included: RankedContextItem[];
  dropped: RankedContextItem[];
}

/**
 * Walks items in rank order, keeping each one that still fits the budget.
 * A lower-ranked item is never admitted just because it happens to be
 * small enough to slot in after a bigger higher-priority one was dropped
 * — order is preserved, not repacked, so priority stays meaningful. The
 * highest-priority item is always kept even if it alone exceeds the
 * budget (an empty context is worse than a slightly-over-budget one).
 */
export function enforceBudget(ranked: RankedContextItem[], tokenBudget: number): BudgetResult {
  const included: RankedContextItem[] = [];
  const dropped: RankedContextItem[] = [];
  let used = 0;

  for (const item of ranked) {
    if (used + item.tokens > tokenBudget && included.length > 0) {
      dropped.push(item);
      continue;
    }
    included.push(item);
    used += item.tokens;
  }

  return { included, dropped };
}
