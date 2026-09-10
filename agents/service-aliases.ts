/**
 * Normalizes a free-text service/topic hint into a stable memory key.
 * `forgeguard-demo` is the real thing PR analysis is about (GITHUB_REPO —
 * see docs/decisions/ADR-021-demo-target-repo.md) and the default for
 * anything that doesn't clearly name something else; `forgeguard` (the
 * tool itself, a distinct real thing) is recognized separately. Any other
 * word is kept as-is so `remember`/`recall` still works for whatever topic
 * someone actually mentions (used by the `remember` intent and
 * generalChat's memory-recall lookup in agents/planner.ts).
 */
export function normalizeServiceId(text: string): string {
  const normalized = text.toLowerCase();
  if (/\bforgeguard-demo\b/.test(normalized)) return "forgeguard-demo";
  if (/\bforgeguard\b/.test(normalized)) return "forgeguard";

  const firstWord = normalized.trim().split(/\s+/)[0]?.replace(/[^a-z0-9-]/g, "");
  return firstWord || "forgeguard-demo";
}
