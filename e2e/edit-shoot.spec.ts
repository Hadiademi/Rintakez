import { test, expect } from "@playwright/test";
import { SEED, login, futureDate } from "./helpers";

test.describe("edit shoot (P4 core loop)", () => {
  test.setTimeout(90_000);

  test("a client posts a shoot then edits it without losing it", async ({
    page,
  }) => {
    await login(page, SEED.client.email, SEED.client.password);

    const title = `Edit E2E ${Date.now()}`;

    // Post a video shoot through the wizard.
    await page.goto("/de/shoots/new");
    await page.getByTestId("shoot-discipline-video").click();
    await page.getByTestId("shoot-type-portrait").click();
    await page.getByTestId("shoot-next").click();

    await page.getByTestId("shoot-city").fill("Bern");
    await page.getByTestId("shoot-canton").selectOption("BE");
    await page.getByTestId("shoot-date").fill(futureDate());
    await page.getByTestId("shoot-duration").fill("3");
    await page.getByTestId("shoot-next").click();

    await page.getByTestId("shoot-title").fill(title);
    await page
      .getByTestId("shoot-brief")
      .fill("Automatisierter Test-Brief mit genug Zeichen.");
    await page.getByTestId("shoot-budget-min").fill("1000");
    await page.getByTestId("shoot-budget-max").fill("1500");
    await page.getByTestId("shoot-submit").click();

    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}$/, {
      timeout: 20_000,
    });

    // Edit it.
    const newTitle = `${title} EDITED`;
    await page.getByRole("link", { name: "Bearbeiten" }).click();
    await expect(page).toHaveURL(/\/edit$/, { timeout: 20_000 });
    await page.locator("#e-title").fill(newTitle);
    await page.getByRole("button", { name: "Änderungen speichern" }).click();

    // Back on the detail page with the new title (same shoot, bids intact).
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}$/, {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: newTitle })
    ).toBeVisible({ timeout: 20_000 });
  });
});
