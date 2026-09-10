import { test, expect } from "@playwright/test";

test("incident: memory lookup, live symptom report, correlated rollback approval", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.waitForSelector("text=Connected", { timeout: 10_000 });

  async function send(text: string) {
    await page.fill("input[placeholder^='Ask']", text);
    await page.click("button:has-text('Send')");
  }

  await send("Investigate the payment-service incident");
  await expect(page.locator("text=/Prior incidents for payment-service/")).toBeVisible({ timeout: 10_000 });

  await send("Payments are returning 500s, investigate");
  // payment-service is high-criticality — the correlated hypothesis should
  // pause for rollback approval rather than auto-resolving.
  await expect(page.locator("text=/waiting for approval/")).toBeVisible({ timeout: 20_000 });

  await page.click("button:has-text('Approve')");
  await expect(page.locator("text=/Root cause hypothesis/")).toBeVisible({ timeout: 15_000 });

  expect(errors).toEqual([]);
});
