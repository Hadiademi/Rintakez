// Precondition: run `npx supabase db reset` for clean seed state (CI e2e job does this).
import { test, expect } from "@playwright/test";
import { SEED, login, futureDate } from "./helpers";

// Regression for review UI-01: the wizard's "Weiter" and "Veröffentlichen"
// buttons shared one DOM slot, so the click that advanced from step 2 to step 3
// was also processed as a submit. Step 3 opened covered in validation errors,
// and going Back then Next published the shoot without the user pressing
// "Veröffentlichen".
test.describe("new-shoot wizard", () => {
  test.setTimeout(90_000);

  test("advancing never submits: step 3 opens clean, Back then Next stays on the form", async ({
    page,
  }) => {
    await login(page, SEED.client.email, SEED.client.password);
    await page.goto("/de/shoots/new");

    // A draft left by an earlier run would restore a later step; start clean.
    const discard = page.getByTestId("shoot-draft-discard");
    if (await discard.isVisible().catch(() => false)) await discard.click();

    await page.getByTestId("shoot-type-portrait").click();
    await page.getByTestId("shoot-next").click();

    await page.getByTestId("shoot-city").fill("Bern");
    await page.getByTestId("shoot-postcode").fill("3011");
    await page.getByTestId("shoot-canton").selectOption("BE");
    await page.getByTestId("shoot-date").fill(futureDate());
    await page.getByTestId("shoot-duration").fill("2");
    await page.getByTestId("shoot-next").click();

    const form = page.locator("form");
    const fieldErrors = form.locator("p.text-accent");

    // Step 3 is open and untouched: no validation errors yet.
    await expect(page.getByTestId("shoot-title")).toBeVisible();
    await expect(fieldErrors).toHaveCount(0);

    // Back to step 2 and forward again: still the form, still no errors.
    await page.getByTestId("shoot-back").click();
    await expect(page.getByTestId("shoot-city")).toBeVisible();
    await page.getByTestId("shoot-next").click();
    await expect(page.getByTestId("shoot-title")).toBeVisible();
    await page.waitForTimeout(1500); // a stray submit would navigate or render errors by now
    await expect(page).toHaveURL(/\/de\/shoots\/new$/);
    await expect(fieldErrors).toHaveCount(0);
  });
});
