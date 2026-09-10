/** One candidate piece of context, before ranking/budgeting decides what survives. */
export interface ContextSource {
  source: string;
  /** Lower = considered first when the budget is tight. */
  priority: number;
  /** 0–1 tie-breaker among sources sharing a priority. Defaults to 1. */
  relevance?: number;
  content: string;
}

/** A source after token estimation, before the budget cut is applied. */
export interface RankedContextItem extends Required<ContextSource> {
  tokens: number;
}

/** Per-item outcome, kept for observability even after budgeting. */
export interface ContextItemStat {
  source: string;
  priority: number;
  relevance: number;
  tokens: number;
  included: boolean;
}

export interface BuiltContext {
  text: string;
  includedSections: string[];
  droppedSections: string[];
  estimatedTokens: number;
  items: ContextItemStat[];
}
