import { defineConfig } from "@playwright/test";

/**
 * A checked-in version of the manual verification passes done throughout
 * development (see ADR history) — separate from `npm test` (vitest, no
 * browser) on purpose: `npm run test:e2e` is its own explicit command with
 * its own CI job, since a browser + a live Worker is a meaningfully
 * heavier dependency than the rest of this project's test suite needs.
 * `webServer` builds the dashboard, applies D1 migrations, and starts
 * `wrangler dev` automatically — `npm run test:e2e` is fully self-contained.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // `wrangler dev --local` is one single-threaded process; 4 spec files
  // hitting it concurrently caused real resource contention that pushed
  // workflow-approval polling past its timeout (observed directly — not
  // a hypothetical). Shared local D1/DO state across specs is a second,
  // independent reason to keep this serial.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8795",
    screenshot: "only-on-failure"
  },
  webServer: {
    // Starts from a clean `.wrangler/state` every run: release-agent.ts's
    // idempotency keys (ADR-010) are deterministic (`release-1842`, ...),
    // so accumulated state from a previous run — or from manual `wrangler
    // dev` testing — makes create() resolve to an already-completed
    // instance instead of a fresh one, and the approval step never
    // appears. Discovered by running this suite for real, not a
    // hypothetical: see docs/decisions/ADR-016-e2e-suite.md.
    command: "rm -rf .wrangler/state && npm run build:dashboard && npm run db:migrate:local && wrangler dev --port 8795 --local",
    url: "http://localhost:8795",
    reuseExistingServer: false,
    timeout: 60_000
  }
});
