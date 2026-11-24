// Precondition: run `npx supabase db reset` for clean seed state.
import { test, expect, type Page } from "@playwright/test";
import { SEED, closeMoment, confirmDialog, futureDate, login } from "./helpers";

// An admin must be able to take any shoot off the platform at once: hide it
// (reversible) or delete it for good. Regression for a client's unsuitable
// reference photo that stayed the landing page's hero image because admins had
// no way to act on a shoot nobody had reported.
test.describe("admin shoot moderation", () => {
  test.setTimeout(120_000);

  async function landingLinksTo(page: Page, shootId: string): Promise<boolean> {
    await page.goto("/de");
    return (await page.locator(`a[href="/de/shoots/${shootId}"]`).count()) > 0;
  }

  test("an admin hides, restores and deletes a client's shoot", async ({ browser }) => {
    const title = `Moderation-Test ${Date.now()}`;

    // A client publishes a shoot; as the newest open shoot it is on the landing page.
    const clientContext = await browser.newContext();
    const client = await clientContext.newPage();
    await login(client, SEED.client2.email, SEED.client2.password);
    await client.goto("/de/shoots/new");
    const discard = client.getByTestId("shoot-draft-discard");
    if (await discard.isVisible().catch(() => false)) await discard.click();
    await client.getByTestId("shoot-type-portrait").click();
    await client.getByTestId("shoot-next").click();
    await client.getByTestId("shoot-city").fill("Chur");
    await client.getByTestId("shoot-canton").selectOption("GR");
    await client.getByTestId("shoot-date").fill(futureDate());
    await client.getByTestId("shoot-duration").fill("2");
    await client.getByTestId("shoot-next").click();
    await client.getByTestId("shoot-title").fill(title);
    await client.getByTestId("shoot-brief").fill("Automatisierter Test für die Admin-Moderation.");
    await client.getByTestId("shoot-budget-min").fill("500");
    await client.getByTestId("shoot-budget-max").fill("1000");
    await client.getByTestId("shoot-submit").click();
    await expect(client).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await closeMoment(client, "Dein Auftrag ist online");
    const shootId = client.url().match(/shoots\/([0-9a-f-]{36})/)![1];

    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    // Publishing does not purge the landing cache (up to a minute, unchanged
    // behaviour) — wait for the shoot to arrive there first.
    await expect
      .poll(() => landingLinksTo(visitor, shootId), { timeout: 90_000, intervals: [5_000] })
      .toBe(true);

    // The admin hides it straight from the shoot page.
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await login(admin, SEED.admin.email, SEED.admin.password);
    await admin.goto(`/de/shoots/${shootId}`);
    const panel = admin.getByTestId("shoot-admin-panel");
    await expect(panel).toBeVisible();
    await panel.getByTestId("admin-shoot-suspend").click();
    await confirmDialog(admin);
    await expect(panel.getByTestId("admin-shoot-suspend")).toHaveText("Sperre aufheben");

    // Gone for visitors at once — not after the landing cache's minute.
    expect(await landingLinksTo(visitor, shootId)).toBe(false);

    // Restored from the admin list, where suspended shoots still show.
    await admin.goto("/de/admin/shoots?filter=suspended");
    const row = admin.getByTestId(`admin-shoot-${shootId}`);
    await expect(row).toBeVisible();
    await row.getByTestId("admin-shoot-suspend").click();
    await expect(row.getByTestId("admin-shoot-suspend")).toHaveText("Auftrag sperren");
    expect(await landingLinksTo(visitor, shootId)).toBe(true);

    // Deleted for good from the list.
    await admin.goto("/de/admin/shoots");
    const listed = admin.getByTestId(`admin-shoot-${shootId}`);
    await listed.getByTestId("admin-shoot-delete").click();
    await confirmDialog(admin);
    await expect(listed).toHaveCount(0, { timeout: 20_000 });

    expect(await landingLinksTo(visitor, shootId)).toBe(false);
    await client.goto(`/de/shoots/${shootId}`);
    await expect(client.getByText("Seite nicht gefunden.")).toBeVisible();

    // The removal is on the audit log.
    await admin.goto("/de/admin/audit");
    await expect(admin.getByText("shoot_deleted").first()).toBeVisible();

    await Promise.all([clientContext.close(), visitorContext.close(), adminContext.close()]);
  });
});
