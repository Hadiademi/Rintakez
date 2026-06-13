// Precondition: run `npx supabase db reset` for clean seed state (CI e2e job does this).
//
// Chosen seed actors (from supabase/seed.sql):
//   Photographer: claire@example.ch (password "password123").
//     Existing bids: only on "Editorial — Vitra Sommerkollektion" (pending).
//   Target OPEN shoot to bid on: "Porträtserie für Forschungsteam"
//     (client lena@example.ch, canton VD, status open) — claire has NO bid here,
//     so the submit-bid flow runs cleanly. It is also the only OPEN shoot in
//     canton VD, which makes the canton filter assertion deterministic.
//   my-bids assertion uses the same shoot title after the bid is submitted.
import { test, expect, type Page } from "@playwright/test";

const SEED_PHOTOGRAPHER_EMAIL = "claire@example.ch";
const PASSWORD = "password123";

// Open shoot in canton VD with no existing bid from claire.
const TARGET_SHOOT_TITLE = "Porträtserie für Forschungsteam";
const TARGET_SHOOT_CANTON = "VD";

async function login(page: Page) {
  await page.goto("/de/login");
  await page.getByTestId("login-email").fill(SEED_PHOTOGRAPHER_EMAIL);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/de\/home/, { timeout: 20_000 });
  // Wait for the authenticated nav so the session cookie is fully committed
  // before we navigate to other protected routes.
  await expect(page.getByTestId("sign-out")).toBeVisible({ timeout: 20_000 });
}

test.describe("photographer flow", () => {
  // Dev server cold-compiles routes on first hit; give each test room.
  test.setTimeout(90_000);

  test("browse shoots and filter by canton", async ({ page }) => {
    await login(page);

    await page.goto("/de/shoots");
    const list = page.getByTestId("browse-list");
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(list.locator("a[href*='/shoots/']").first()).toBeVisible();

    // Filter by the target canton (VD); the URL gains canton= and the list
    // still renders with the known VD shoot present.
    await page.getByTestId("filter-canton").selectOption(TARGET_SHOOT_CANTON);
    await expect(page).toHaveURL(/canton=VD/, { timeout: 20_000 });
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(
      list.getByText(TARGET_SHOOT_TITLE, { exact: true })
    ).toBeVisible({ timeout: 20_000 });
  });

  test("submit a bid on an open shoot", async ({ page }) => {
    await login(page);

    await page.goto("/de/shoots");
    const list = page.getByTestId("browse-list");
    await expect(list).toBeVisible({ timeout: 20_000 });

    // Open the target shoot by its visible title (robust against id changes).
    await list.getByText(TARGET_SHOOT_TITLE, { exact: true }).click();
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}/, {
      timeout: 20_000,
    });

    // Fill and submit the bid sheet.
    await page.getByTestId("bid-amount").fill("2200");
    await page
      .getByTestId("bid-message")
      .fill("Automatisierter Test — dokumentarischer Stil und ehrlich.");
    await page.getByTestId("bid-submit").click();

    // The my-bid panel appears with status "Ausstehend" (pending).
    await expect(page.getByTestId("mybid-status")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("mybid-status")).toContainText("Ausstehend");
  });

  test("the submitted bid appears in my-bids", async ({ page }) => {
    await login(page);

    await page.goto("/de/my-bids");
    await expect(page.getByTestId("my-bids-list")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(TARGET_SHOOT_TITLE, { exact: true })
    ).toBeVisible({ timeout: 20_000 });
  });

  test("withdraw the bid from the shoot detail panel", async ({ page }) => {
    await login(page);

    // Reach the shoot detail via the my-bids card.
    await page.goto("/de/my-bids");
    await expect(page.getByTestId("my-bids-list")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByText(TARGET_SHOOT_TITLE, { exact: true }).click();
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}/, {
      timeout: 20_000,
    });

    // withdrawBidAction sets status='withdrawn'; the bid row still exists, so
    // MyBidPanel keeps rendering and the status flips to "Zurückgezogen".
    // window.confirm is used — auto-accept the dialog before clicking.
    page.on("dialog", (d) => d.accept());

    await expect(page.getByTestId("mybid-withdraw")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("mybid-withdraw").click();

    await expect(page.getByTestId("mybid-status")).toContainText(
      "Zurückgezogen",
      { timeout: 20_000 }
    );
  });
});
