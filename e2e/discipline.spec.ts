import { test, expect } from "@playwright/test";
import { SEED, login } from "./helpers";

test.describe("videographer / disciplines", () => {
  test.setTimeout(90_000);

  test("directory filters professionals by video discipline", async ({
    page,
  }) => {
    await login(page, SEED.client.email, SEED.client.password);

    // Seed: Claire offers photo+video; Marko offers photo only.
    await page.goto("/de/photographers?discipline=video");
    await expect(page.getByText("Claire Dubois")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Marko Brunner")).toHaveCount(0);

    // Photo filter includes Marko.
    await page.goto("/de/photographers?discipline=photo");
    await expect(page.getByText("Marko Brunner")).toBeVisible({
      timeout: 20_000,
    });
  });
});
