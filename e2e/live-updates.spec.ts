// Precondition: run `npx supabase db reset` for clean seed state.
import { test, expect } from "@playwright/test";
import { SEED, closeMoment, confirmDialog, futureDate, login } from "./helpers";

// The app updates itself: a client elsewhere in the app gets a toast naming
// the shoot when an offer arrives; on the shoot itself the offer is listed
// marked "new", and the unread count leads the tab title — no reload.
test.describe("live updates", () => {
  test.setTimeout(120_000);

  test("an offer reaches the client live, without a reload", async ({ browser }) => {
    const clientCtx = await browser.newContext();
    const client = await clientCtx.newPage();
    await login(client, SEED.client2.email, SEED.client2.password);

    // A fresh shoot in Zürich (covered by the seeded photographer).
    const title = `E2E Live ${Date.now()}`;
    await client.goto("/de/shoots/new");
    const discard = client.getByTestId("shoot-draft-discard");
    if (await discard.isVisible().catch(() => false)) await discard.click();
    await client.getByTestId("shoot-type-event").click();
    await client.getByTestId("shoot-next").click();
    await client.getByTestId("shoot-city").fill("Zürich");
    await client.getByTestId("shoot-canton").selectOption("ZH");
    await client.getByTestId("shoot-date").fill(futureDate());
    await client.getByTestId("shoot-duration").fill("2");
    await client.getByTestId("shoot-next").click();
    await client.getByTestId("shoot-title").fill(title);
    await client.getByTestId("shoot-brief").fill("Live-Test: ein Angebot soll ohne Neuladen erscheinen.");
    await client.getByTestId("shoot-budget-min").fill("800");
    await client.getByTestId("shoot-budget-max").fill("1200");
    await client.getByTestId("shoot-submit").click();
    await expect(client).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await closeMoment(client, "Dein Auftrag ist online");
    const shootUrl = client.url();
    // Wait on an overview (the shoot page would answer by itself instead of
    // toasting); give the realtime subscription a moment to join.
    await client.goto("/de/my-shoots");
    await expect(client.getByTestId("my-shoots-list")).toBeVisible({ timeout: 20_000 });
    await client.waitForTimeout(2_000);

    const photoCtx = await browser.newContext();
    const photographer = await photoCtx.newPage();
    await login(photographer, SEED.photographer.email, SEED.photographer.password);
    await photographer.goto(shootUrl);
    await photographer.getByTestId("bid-amount").fill("950");
    await photographer.getByTestId("bid-message").fill("Gerne übernehme ich das – Live-Test.");
    await photographer.getByTestId("bid-submit").click();
    // The sender learns who was told.
    await expect(photographer.getByRole("status").filter({ hasText: "Angebot gesendet" })).toContainText(
      "wurde benachrichtigt",
      { timeout: 20_000 }
    );

    // The client, untouched since: a toast naming the shoot, leading to it…
    const live = client.getByRole("status").filter({ hasText: "Neues Angebot erhalten" });
    await expect(live).toContainText(title, { timeout: 20_000 });
    await expect.poll(() => client.title(), { timeout: 10_000 }).toMatch(/^\(\d\) /);
    await live.getByRole("link", { name: "Ansehen" }).click();
    await expect(client).toHaveURL(shootUrl, { timeout: 20_000 });
    // …where the offer is listed and marked new since the last visit.
    const bids = client.getByTestId("bids-list");
    await expect(bids).toContainText(/950/, { timeout: 20_000 });
    await expect(bids.getByTestId("offer-new")).toBeVisible();

    // And in the browse list, the photographer's card says the offer is out.
    await photographer.goto("/de/shoots");
    const card = photographer.getByTestId("browse-list").locator("a", { hasText: title });
    await expect(card.getByTestId("shoot-card-bid-sent")).toBeVisible({ timeout: 20_000 });

    // The photographer withdraws: the client (who heard nothing about that
    // before) sees the offer leave their open page, again without a reload.
    await photographer.goto(shootUrl);
    await photographer.getByTestId("mybid-withdraw").click();
    await confirmDialog(photographer);
    await expect(bids).toHaveCount(0, { timeout: 20_000 });
    await expect(client.getByText("1 früheres Angebot nicht mehr aktiv")).toBeVisible();

    await photoCtx.close();
    await clientCtx.close();
  });
});
