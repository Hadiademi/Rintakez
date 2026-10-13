// Precondition: run `npx supabase db reset` for clean seed state.
import { test, expect } from "@playwright/test";
import { SEED, confirmDialog, login } from "./helpers";

// The shoot owner compares offers side by side once there are at least two
// (BidCompare existed and was unit-tested but was never rendered).
// Seed: "Editorial — Vitra Sommerkollektion" (owner vitra) has one pending
// offer from Claire; Marko adds a second, lower one here.
const SHOOT = "Editorial — Vitra Sommerkollektion";

test.describe("bid comparison", () => {
  test.setTimeout(90_000);

  test("with two offers the owner compares them, sorts by price and can decline one", async ({ page }) => {
    // Marko's offer (7200) is the newest but more expensive than Claire's
    // seeded 5600, so sorting by price must change the order.
    await login(page, SEED.photographer.email, SEED.photographer.password);
    await page.goto("/de/shoots");
    await page.getByTestId("browse-list").getByText(SHOOT, { exact: true }).click();
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const shootUrl = page.url();
    await page.getByTestId("bid-amount").fill("7200");
    await page.getByTestId("bid-message").fill("Zweites Angebot für den Vergleich — ruhiger, sachlicher Stil.");
    await page.getByTestId("bid-submit").click();
    await expect(page.getByTestId("mybid-status")).toBeVisible({ timeout: 20_000 });

    await page.context().clearCookies();
    await login(page, SEED.client2.email, SEED.client2.password);
    await page.goto(shootUrl);

    const compare = page.getByTestId("bid-compare");
    await expect(compare).toBeVisible({ timeout: 20_000 });
    const cards = page.getByTestId("bid-compare-grid").locator("> article");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText(/7.200/); // newest first by default

    await page.getByTestId("bid-sort-price").click();
    await expect(cards.first()).toContainText(/5.600/);
    await expect(cards.nth(1)).toContainText(/7.200/);

    // Phone width: the comparison must not scroll sideways.
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Declining stays possible in the comparison view (it replaced the cards
    // that had the decline button). With one offer left, the single card shows.
    await cards.filter({ hasText: /7.200/ }).locator('[data-testid^="bid-decline-"]').click();
    await confirmDialog(page);
    await expect(page.getByText("Angebot abgelehnt")).toBeVisible();
    await expect(compare).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("bids-list")).toContainText(/5.600/);
  });
});
