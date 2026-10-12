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

  // revFADP Art. 25: the export must contain everything we hold about the
  // user. Since 20261013120000 the verification note is no longer selectable
  // through the API, so the export reads it via my_verification_note(); a
  // plain select("*") would have dropped the photographer's details silently.
  test("a photographer's data export includes their details and verification note", async ({
    page,
  }) => {
    await login(page, SEED.photographer.email, SEED.photographer.password);
    await page.goto("/de/profile");
    await page.getByTestId("profile-tab-privacy").click();

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: "Meine Daten herunterladen" }).click(),
    ]);
    const exported = JSON.parse(
      await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"))
    );

    expect(exported.export_complete).toBe(true);
    expect(exported.photographer_details).toMatchObject({
      verification_note: "Website: markostudio.ch · Handelsregister CHE-123.456.789",
    });
    expect(exported.photographer_details.specialties.length).toBeGreaterThan(0);
  });
});
