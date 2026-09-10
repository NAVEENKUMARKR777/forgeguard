import { test, expect } from "@playwright/test";

/**
 * The critical path: dashboard -> release analysis (incl. GitOps/risk/
 * policy) -> workflow -> human approval -> automatic remediation. This is
 * ForgeGuard's central architectural claim (ADR-003) exercised against a
 * real running Worker, not a mock.
 */
test("release: analyze, explain, remediate, approve, auto-remediate", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.waitForSelector("text=Connected", { timeout: 10_000 });

  async function send(text: string) {
    await page.fill("input[placeholder^='Ask']", text);
    await page.click("button:has-text('Send')");
  }

  await send("Is PR #1842 safe to deploy?");
  // The risk gauge renders score/"/100"/band as three separate <span>s
  // (RiskGauge.tsx) — asserting on the band label rather than trying to
  // match a number is robust to that, and to which model provider is
  // narrating (real LLM prose splits "Risk"/the score across markdown
  // elements a plain-fallback message never did — see ADR-019).
  await expect(page.locator("aside").getByText(/HIGH|CRITICAL/)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("aside").getByText(/Release risk.*PR #1842/)).toBeVisible();

  await send("Why is it risky?");
  await expect(page.locator("main >> text=/scored .*100/")).toBeVisible({ timeout: 10_000 });

  await send("What should I fix first?");
  await expect(page.locator("main >> text=/Recommended remediation/")).toBeVisible({ timeout: 10_000 });

  await send("Start the remediation workflow");
  await expect(page.locator("text=waiting for your decision")).toBeVisible({ timeout: 20_000 });

  await page.click("button:has-text('Approve')");
  await expect(page.locator("text=/finished with status: complete/")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("main >> text=/remediation workflow .* rolling it out/")).toBeVisible({ timeout: 10_000 });

  expect(errors).toEqual([]);
});
