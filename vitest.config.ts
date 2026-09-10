import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tests/e2e/*.spec.ts are Playwright specs (see playwright.config.ts,
    // run via `npm run test:e2e`) — they use @playwright/test's own
    // test()/expect(), which vitest would otherwise also try to pick up
    // since it matches *.spec.ts by default, and fail to run.
    exclude: ["**/node_modules/**", "tests/e2e/**"]
  }
});
