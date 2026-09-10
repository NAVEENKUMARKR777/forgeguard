import { test, expect } from "@playwright/test";

/**
 * forgeguard is real-and-honestly medium-criticality (not the fixture
 * world's high-criticality payment-service), so `rollbackRequiresApproval`
 * never pauses for it — see agents/incident-agent.ts and
 * incident/correlate.ts. The real flow is memory lookup, then a live
 * symptom report that auto-resolves with a hypothesis, no approval step.
 */
test("incident: memory lookup, live symptom report, auto-resolved hypothesis", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.waitForSelector("text=Connected", { timeout: 10_000 });

  async function send(text: string) {
    await page.fill("input[placeholder^='Ask']", text);
    await page.click("button:has-text('Send')");
  }

  await send("Investigate the forgeguard incident");
  await expect(
    page.locator("text=/Prior incidents for forgeguard|No prior incidents on record for forgeguard/")
  ).toBeVisible({ timeout: 10_000 });

  await send("forgeguard is returning 500s, investigate");
  await expect(page.locator("text=/Root cause hypothesis/")).toBeVisible({ timeout: 20_000 });

  expect(errors).toEqual([]);
});
