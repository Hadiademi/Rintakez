import { test, expect } from "@playwright/test";
import { SEED, login } from "./helpers";

test.describe("admin console", () => {
  test.setTimeout(90_000);

  test("admin sees dashboard, users and audit log", async ({ page }) => {
    await login(page, SEED.admin.email, SEED.admin.password);

    await page.goto("/de/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible({
      timeout: 20_000,
    });
    // "Needs attention" panel renders.
    await expect(page.getByText("Handlungsbedarf")).toBeVisible();

    // Users tab lists real accounts (email resolved via the admin client).
    await page.getByRole("link", { name: "Nutzer:innen", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 20_000 });
    await expect(page.getByText("lena@example.ch")).toBeVisible({
      timeout: 20_000,
    });

    // Audit log surfaces the table.
    await page.goto("/de/admin/audit");
    await expect(
      page.getByRole("heading", { name: "Audit-Log" })
    ).toBeVisible({ timeout: 20_000 });
  });

  test("a non-admin cannot reach /admin", async ({ page }) => {
    await login(page, SEED.client.email, SEED.client.password);
    await page.goto("/de/admin");
    // The admin layout redirects non-admins to /home.
    await expect(page).toHaveURL(/\/de\/home/, { timeout: 20_000 });
  });
});
