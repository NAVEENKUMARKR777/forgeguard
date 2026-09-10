/**
 * Normalizes a free-text service/topic hint into a stable memory key. One
 * real service exists now (forgeguard) — anything that names it, or
 * doesn't clearly name anything else, falls back to it; any other word is
 * kept as-is so `remember`/`recall` still works for whatever topic
 * someone actually mentions (used by the `remember` intent and
 * generalChat's memory-recall lookup in agents/planner.ts).
 */
export function normalizeServiceId(text: string): string {
  const normalized = text.toLowerCase();
  if (/\bforgeguard\b/.test(normalized)) return "forgeguard";

  const firstWord = normalized.trim().split(/\s+/)[0]?.replace(/[^a-z0-9-]/g, "");
  return firstWord || "forgeguard";
}
