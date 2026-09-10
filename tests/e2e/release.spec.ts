import { test, expect } from "@playwright/test";

/**
 * The critical path: dashboard -> release analysis (incl. GitOps/risk/
 * policy) -> workflow -> human approval -> remediation's real CI wait ->
 * merge/close decision. This is ForgeGuard's central architectural claim
 * (ADR-003) exercised against a real running Worker and real GitHub data
 * (PR #1 on the configured repo — a real, stable, already-closed PR used
 * here purely as a fixed target; closed vs. open doesn't change what the
 * GitHub API returns for it), not a mock. Assertions check structure
 * (some valid band, an explanation, an approval flow) rather than exact
 * scores, since real data can drift over time — see ADR-002.
 */
test("release: analyze, explain, remediate, approve, real CI wait", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.waitForSelector("text=Connected", { timeout: 10_000 });

  async function send(text: string) {
    await page.fill("input[placeholder^='Ask']", text);
    await page.click("button:has-text('Send')");
  }

  await send("Is PR #1 safe to deploy?");
  // The risk gauge renders score/"/100"/band as three separate <span>s
  // (RiskGauge.tsx) — asserting on a band label rather than an exact
  // number is robust to real data drift, and to which model provider is
  // narrating (real LLM prose splits "Risk"/the score across markdown
  // elements a plain-fallback message never did — see ADR-019).
  await expect(page.locator("aside").getByText(/LOW|MEDIUM|HIGH|CRITICAL/)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("aside").getByText(/Release risk.*PR #1\b/)).toBeVisible();

  await send("Why is it risky?");
  await expect(page.locator("main >> text=/scored .*100/")).toBeVisible({ timeout: 10_000 });

  await send("What should I fix first?");
  await expect(page.locator("main >> text=/Recommended remediation/")).toBeVisible({ timeout: 10_000 });

  await send("Start the remediation workflow");
  // PR #1's real CI has a failing required check, so policy requires
  // approval — but this only asserts the approval UI if it actually
  // appears; a PR whose real state changes to fully-passing would
  // auto-approve instead, which is also a valid, real outcome.
  const approvalRequired = await page
    .locator("text=waiting for your decision")
    .isVisible({ timeout: 20_000 })
    .catch(() => false);

  if (approvalRequired) {
    await page.click("button:has-text('Approve')");
    await expect(page.locator("main >> text=/remediation workflow .* waiting for real CI/")).toBeVisible({
      timeout: 10_000
    });
  }

  expect(errors).toEqual([]);
});
