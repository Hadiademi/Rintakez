import { test, expect } from "@playwright/test";
import { SEED, login } from "./helpers";

test.describe("account settings", () => {
  test.setTimeout(90_000);

  test("security + notification sections render and a pref saves", async ({
    page,
  }) => {
    await login(page, SEED.client.email, SEED.client.password);
    await page.goto("/de/profile");

    // Settings became tabbed panels in the profile redesign: only the active
    // section renders, so select each tab before asserting its content.
    await page.getByTestId("profile-tab-security").click();
    // "Aktuelles Passwort" is unique to the change-password form.
    await expect(page.getByText("Aktuelles Passwort")).toBeVisible({
      timeout: 20_000,
    });

    // Toggle a notification preference; it persists (server action).
    await page.getByTestId("profile-tab-notifications").click();
    await page.getByRole("switch").first().click();
    // The unified toast (role=status) is the save confirmation; an inline
    // "Gespeichert." paragraph also exists, so target the toast specifically.
    await expect(
      page.getByRole("status").getByText("Gespeichert.")
    ).toBeVisible({ timeout: 20_000 });
  });
});
