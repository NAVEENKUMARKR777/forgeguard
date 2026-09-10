import type { GitOpsState } from "../types/gitops";
import paymentProduction from "../fixtures/gitops/payment-service-production.json";
import paymentStaging from "../fixtures/gitops/payment-service-staging.json";
import checkoutProduction from "../fixtures/gitops/checkout-service-production.json";
import identityProduction from "../fixtures/gitops/identity-service-production.json";
import notificationsProduction from "../fixtures/gitops/notifications-service-production.json";

const STATES: GitOpsState[] = [
  paymentProduction,
  paymentStaging,
  checkoutProduction,
  identityProduction,
  notificationsProduction
] as GitOpsState[];

/**
 * Fixture-backed GitOps state lookup — same pattern as mcp/github.ts.
 * A live mode (reading real deployment state from Cloudflare/GitHub APIs)
 * would implement the same signature; nothing downstream cares which one
 * is behind it. See docs/decisions/ADR-009-gitops.md.
 */
export function getGitOpsState(service: string, environment = "production"): GitOpsState | null {
  return STATES.find((s) => s.service === service && s.environment === environment) ?? null;
}
