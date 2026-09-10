import { test, expect } from "@playwright/test";

test("evals: renders real suite results and run history", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/evals");
  await expect(page.locator("text=/[0-9]+ passed/")).toBeVisible({ timeout: 10_000 });

  // All 6 suites from evals/run.ts should be represented.
  for (const suite of ["risk", "tool-selection", "policy", "memory", "incident", "remediation"]) {
    await expect(page.locator(`text=${suite}`).first()).toBeVisible();
  }

  // Run history / comparison section (backed by D1 — see ADR-015). It
  // degrades to one of two explanatory messages depending on *why* there's
  // nothing to show yet (D1 fetch failed vs. D1 reachable but empty — see
  // EvalRunHistory.tsx), so this only asserts *some* form of the section
  // rendered, not a specific delta. `.first()` because these are never
  // shown two at once, but Playwright's strict mode still requires
  // disambiguating a regex that could multi-match.
  await expect(
    page.locator("text=/Run comparison|Previous runs|No recorded runs yet|No recorded run history/").first()
  ).toBeVisible({
    timeout: 10_000
  });

  expect(errors).toEqual([]);
});
