// Precondition: run `npx supabase db reset` for clean seed state (CI e2e job does this).
import { test, expect } from "@playwright/test";
import { SEED, login } from "./helpers";

// Regression for review FLOW-04: once a shoot was booked ("Vergeben"), the
// client had no way to cancel it — the button only rendered for open shoots —
// so a postponed wedding stayed booked and blocked the photographer's date.
// The backend (status guard, notification, email) already allowed it.
test.describe("booking lifecycle", () => {
  test.setTimeout(90_000);

  test("the client can cancel a booked shoot", async ({ page }) => {
    await login(page, SEED.client2.email, SEED.client2.password);
    await page.goto("/de/my-shoots");
    await page.getByText("Produktfotografie Bürostuhl EVO", { exact: true }).click();
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    await expect(page.getByText("Vergeben", { exact: true }).first()).toBeVisible();

    await page.getByTestId("cancel-shoot").click();
    await page.getByTestId("cancel-reason").fill("Der Termin wurde verschoben.");
    await page.getByTestId("cancel-shoot-confirm").click();

    await expect(page.getByText("Storniert", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("cancel-shoot")).toHaveCount(0);

    // The photographer's view of the same page (the cancellation email links
    // here) must not still congratulate them on the booking.
    const shootUrl = page.url();
    await page.context().clearCookies();
    await login(page, SEED.photographer.email, SEED.photographer.password);
    await page.goto(shootUrl);
    await expect(page.getByText("Storniert", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Glückwunsch/)).toHaveCount(0);
  });
});
