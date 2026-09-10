const ALIASES: Record<string, string> = {
  payments: "payment-service",
  payment: "payment-service",
  checkout: "checkout-service",
  identity: "identity-service",
  auth: "identity-service",
  notifications: "notifications-service"
};

const KNOWN_SERVICE_IDS = ["payment-service", "checkout-service", "identity-service", "notifications-service"];

/**
 * Maps informal service names ("payments") to the canonical fixture id
 * ("payment-service"), and can also pull a service mention out of a longer
 * sentence ("How should we deploy payments?" -> "payment-service"). Used by
 * the `remember` intent and by generalChat's memory-recall lookup.
 */
export function normalizeServiceId(text: string): string {
  const normalized = text.toLowerCase();

  for (const id of KNOWN_SERVICE_IDS) {
    if (normalized.includes(id)) return id;
  }
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(normalized)) return id;
  }

  const firstWord = normalized.trim().split(/\s+/)[0]?.replace(/[^a-z0-9-]/g, "");
  if (!firstWord) return normalized.trim();
  return firstWord.endsWith("-service") ? firstWord : `${firstWord}-service`;
}
