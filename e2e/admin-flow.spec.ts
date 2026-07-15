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

  test("admin navigation is reachable on a 390px viewport", async ({ page }) => {
    // login() asserts the desktop sign-out testid, which is CSS-hidden below
    // the `lg` breakpoint (the mobile nav's sign-out deliberately omits the
    // testid to keep Playwright strict-mode happy — see app-nav.tsx). So log
    // in at the default desktop viewport, then resize before exercising the
    // mobile admin nav.
    await login(page, SEED.admin.email, SEED.admin.password);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/de/admin");

    // The desktop rail is hidden on mobile; the drawer is the only way through.
    await page.getByTestId("admin-drawer-open").click();
    await page
      .getByTestId("admin-drawer")
      .getByTestId("admin-nav-users")
      .click();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByTestId("admin-drawer")).toBeHidden();
    // The page must not scroll sideways at 390.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("admin drawer closes on Escape and returns focus to the hamburger", async ({
    page,
  }) => {
    await login(page, SEED.admin.email, SEED.admin.password);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/de/admin");

    const opener = page.getByTestId("admin-drawer-open");
    await opener.click();
    await expect(page.getByTestId("admin-drawer")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("admin-drawer")).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
