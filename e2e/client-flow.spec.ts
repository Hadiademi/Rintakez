// Precondition: run `npx supabase db reset` for clean seed state (CI e2e job does this).
import { test, expect, type Page } from "@playwright/test";

const SEED_CLIENT_EMAIL = "lena@example.ch";
const PASSWORD = "password123";

// Seeded open shoot owned by lena that has a pending bid from Marko Brunner.
const SEEDED_OPEN_SHOOT_WITH_BID = "Hochzeit in Zermatt";

async function login(page: Page) {
  await page.goto("/de/login");
  await page.getByTestId("login-email").fill(SEED_CLIENT_EMAIL);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/de\/home/, { timeout: 20_000 });
  // Wait for the authenticated nav so the session cookie is fully committed
  // before we navigate to other protected routes.
  await expect(page.getByTestId("sign-out")).toBeVisible({ timeout: 20_000 });
}

test.describe("client flow", () => {
  // Dev server cold-compiles routes on first hit; give each test room.
  test.setTimeout(90_000);

  test("post a shoot, detail page, then it appears in my-shoots", async ({
    page,
  }) => {
    await login(page);

    const uniqueTitle = `E2E Shoot ${Date.now()}`;
    const futureYear = new Date().getFullYear() + 1;
    const futureDate = `${futureYear}-09-15`;

    await page.goto("/de/shoots/new");

    // Step 0 — type
    await page.getByTestId("shoot-type-wedding").click();
    await page.getByTestId("shoot-next").click();

    // Step 1 — where & when
    await page.getByTestId("shoot-city").fill("Genf");
    await page.getByTestId("shoot-postcode").fill("1200");
    await page.getByTestId("shoot-canton").selectOption("GE");
    await page.getByTestId("shoot-date").fill(futureDate);
    await page.getByTestId("shoot-duration").fill("6");
    await page.getByTestId("shoot-next").click();

    // Step 2 — details & budget
    await page.getByTestId("shoot-title").fill(uniqueTitle);
    await page
      .getByTestId("shoot-brief")
      .fill("Automatisierter Test-Brief mit genug Zeichen.");
    await page.getByTestId("shoot-budget-min").fill("2000");
    await page.getByTestId("shoot-budget-max").fill("3000");
    await page.getByTestId("shoot-submit").click();

    // Lands on the new shoot detail page (UUID in URL).
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}/, {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: uniqueTitle })
    ).toBeVisible();
    await expect(page.getByText("Offen", { exact: true }).first()).toBeVisible();

    // Verify it now appears in my-shoots.
    await page.goto("/de/my-shoots");
    await expect(page.getByTestId("my-shoots-list")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(uniqueTitle, { exact: true })).toBeVisible();
  });

  test("accept a bid on the seeded open shoot reveals contact", async ({
    page,
  }) => {
    await login(page);

    await page.goto("/de/my-shoots");
    await expect(page.getByTestId("my-shoots-list")).toBeVisible({
      timeout: 20_000,
    });

    // Open the seeded open-shoot-with-bid by its title.
    await page
      .getByText(SEEDED_OPEN_SHOOT_WITH_BID, { exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}/, {
      timeout: 20_000,
    });

    // BidCard.onAccept uses window.confirm — auto-accept the dialog.
    page.on("dialog", (d) => d.accept());

    const acceptButton = page
      .locator('[data-testid^="bid-accept-"]')
      .first();
    await expect(acceptButton).toBeVisible({ timeout: 20_000 });
    await acceptButton.click();

    // Status flips to "Vergeben" and the contact card with a mailto/email appears.
    await expect(
      page.getByText("Vergeben", { exact: true }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("contact-reveal")).toBeVisible();
    await expect(page.getByTestId("contact-email")).toHaveAttribute(
      "href",
      /^mailto:.+@.+/
    );
  });
});
