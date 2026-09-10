import { describe, expect, it } from "vitest";
import { buildContext } from "../context/builder";
import { rankSources } from "../context/ranking";
import { enforceBudget } from "../context/budget";
import type { ContextSource, RankedContextItem } from "../context/types";

describe("rankSources", () => {
  it("orders by priority ascending", () => {
    const ranked = rankSources([
      { source: "c", priority: 3, content: "x" },
      { source: "a", priority: 1, content: "x" },
      { source: "b", priority: 2, content: "x" }
    ]);
    expect(ranked.map((r) => r.source)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties on relevance descending", () => {
    const ranked = rankSources([
      { source: "low-relevance", priority: 1, relevance: 0.2, content: "x" },
      { source: "high-relevance", priority: 1, relevance: 0.9, content: "x" }
    ]);
    expect(ranked.map((r) => r.source)).toEqual(["high-relevance", "low-relevance"]);
  });

  it("defaults relevance to 1 when omitted", () => {
    const ranked = rankSources([{ source: "a", priority: 1, content: "x" }]);
    expect(ranked[0].relevance).toBe(1);
  });

  it("collapses duplicate source names, keeping the highest-ranked occurrence", () => {
    const ranked = rankSources([
      { source: "policy_decision", priority: 5, content: "stale" },
      { source: "policy_decision", priority: 1, content: "fresh" }
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].content).toBe("fresh");
  });

  it("computes token estimates for each item", () => {
    const ranked = rankSources([{ source: "a", priority: 1, content: "a".repeat(40) }]);
    expect(ranked[0].tokens).toBe(10); // 40 chars / 4
  });
});

describe("enforceBudget", () => {
  function item(source: string, tokens: number): RankedContextItem {
    return { source, priority: 1, relevance: 1, tokens, content: "x".repeat(tokens * 4) };
  }

  it("keeps everything when it fits", () => {
    const { included, dropped } = enforceBudget([item("a", 10), item("b", 10)], 100);
    expect(included).toHaveLength(2);
    expect(dropped).toHaveLength(0);
  });

  it("drops lower-ranked items once the budget is exceeded", () => {
    const { included, dropped } = enforceBudget([item("a", 60), item("b", 60)], 100);
    expect(included.map((i) => i.source)).toEqual(["a"]);
    expect(dropped.map((i) => i.source)).toEqual(["b"]);
  });

  it("always keeps the first item even if it alone exceeds the budget", () => {
    const { included, dropped } = enforceBudget([item("a", 500)], 100);
    expect(included).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it("never exceeds the budget across multiple items", () => {
    const items = [item("a", 30), item("b", 30), item("c", 30), item("d", 30)];
    const { included } = enforceBudget(items, 70);
    const totalTokens = included.reduce((sum, i) => sum + i.tokens, 0);
    expect(totalTokens).toBeLessThanOrEqual(70);
  });
});

describe("buildContext", () => {
  it("renders included sections in priority order, dropping the rest", () => {
    const sources: ContextSource[] = [
      { source: "background", priority: 9, content: "x".repeat(4000) },
      { source: "current_request", priority: 1, content: "Is this safe?" }
    ];
    const built = buildContext(sources, 10);
    expect(built.includedSections).toEqual(["current_request"]);
    expect(built.droppedSections).toEqual(["background"]);
    expect(built.text).toContain("current_request");
    expect(built.estimatedTokens).toBeLessThanOrEqual(10);
  });

  it("exposes per-item stats including dropped items for observability", () => {
    const sources: ContextSource[] = [
      { source: "a", priority: 1, content: "x".repeat(4000) },
      { source: "b", priority: 2, content: "y".repeat(4000) }
    ];
    const built = buildContext(sources, 10);
    const bItem = built.items.find((i) => i.source === "b");
    expect(bItem?.included).toBe(false);
  });
});
