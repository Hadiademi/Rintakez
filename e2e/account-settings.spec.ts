import { test, expect } from "@playwright/test";
import { SEED, login } from "./helpers";

test.describe("account settings", () => {
  test.setTimeout(90_000);

  test("security + notification sections render and a pref saves", async ({
    page,
  }) => {
    await login(page, SEED.client.email, SEED.client.password);
    await page.goto("/de/profile");

    // Security section (change password / email) is present.
    await expect(page.getByText("Sicherheit")).toBeVisible({ timeout: 20_000 });
    // "Aktuelles Passwort" is unique to the change-password form.
    await expect(page.getByText("Aktuelles Passwort")).toBeVisible();

    // Toggle a notification preference; it persists (server action).
    await page.getByRole("switch").first().click();
    await expect(page.getByText("Gespeichert.")).toBeVisible({
      timeout: 20_000,
    });
  });
});
