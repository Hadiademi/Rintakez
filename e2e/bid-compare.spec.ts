// Precondition: run `npx supabase db reset` for clean seed state.
import { test, expect } from "@playwright/test";
import { SEED, login } from "./helpers";

// The shoot owner compares offers side by side once there are at least two
// (BidCompare existed and was unit-tested but was never rendered).
// Seed: "Editorial — Vitra Sommerkollektion" (owner vitra) has one pending
// offer from Claire; Marko adds a second, lower one here.
const SHOOT = "Editorial — Vitra Sommerkollektion";

test.describe("bid comparison", () => {
  test.setTimeout(90_000);

  test("with two offers the owner gets the comparison and can sort by price", async ({ page }) => {
    await login(page, SEED.photographer.email, SEED.photographer.password);
    await page.goto("/de/shoots");
    await page.getByTestId("browse-list").getByText(SHOOT, { exact: true }).click();
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const shootUrl = page.url();
    await page.getByTestId("bid-amount").fill("950");
    await page.getByTestId("bid-message").fill("Zweites Angebot für den Vergleich — ruhiger, sachlicher Stil.");
    await page.getByTestId("bid-submit").click();
    await expect(page.getByTestId("mybid-status")).toBeVisible({ timeout: 20_000 });

    await page.context().clearCookies();
    await login(page, SEED.client2.email, SEED.client2.password);
    await page.goto(shootUrl);

    const compare = page.getByTestId("bid-compare");
    await expect(compare).toBeVisible({ timeout: 20_000 });
    const grid = page.getByTestId("bid-compare-grid");
    await expect(grid.locator("> *")).toHaveCount(2);

    await page.getByTestId("bid-sort-price").click();
    await expect(grid.locator("> *").first()).toContainText("950");

    // Phone width: the comparison must not scroll sideways.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(compare).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
