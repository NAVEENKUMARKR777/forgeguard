import { test, expect } from "@playwright/test";

/**
 * A real browser's navigation to /productivity is intercepted by the
 * Assets binding before src/worker.ts's fetch handler ever runs (Cloudflare
 * serves the SPA directly for navigation-mode requests when
 * `run_worker_first` is unset) — so `page.goto()` alone would never catch a
 * regression where bare /productivity starts being routed to
 * `productivityFetch` again. `request.get()` issues a plain (non-navigation)
 * fetch, the same request shape curl or an API client would send, and is
 * what actually exercises src/worker.ts's routing check.
 */
test("productivity: bare path is always the SPA, never the JSON API", async ({ request }) => {
  const res = await request.get("/productivity");
  expect(res.headers()["content-type"]).toContain("text/html");
});

test("productivity: renders real metrics for this repo, labeled as live", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/productivity");
  await expect(page.locator("text=Development")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=CI/CD")).toBeVisible();
  await expect(page.locator("text=Reliability")).toBeVisible();

  // The honesty label from productivity/metrics.ts's source: "live" must be
  // visible, not just present in a data attribute — this is the exact
  // guarantee ADR-012 is about, now pointed at real data instead of fixtures.
  await expect(page.locator("text=live GitHub data")).toBeVisible();

  // Switching window should re-fetch without erroring.
  await page.selectOption("select", "7d");
  await page.waitForTimeout(500);

  expect(errors).toEqual([]);
});
