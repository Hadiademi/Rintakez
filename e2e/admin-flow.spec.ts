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

  test("a non-admin receives no admin data, even when the layout is skipped", async ({
    page,
  }) => {
    // Regression for the 2026-10-10 review: the (admin) layout was the only
    // is_admin check, but Next renders the page segment independently of the
    // layout (and skips layouts the client claims to have mounted). The page
    // itself read every user's email through the service-role client.
    const routerState = [
      "",
      {
        children: [
          // [param, cache key, dynamic type, static siblings]
          ["locale", "de", "d", null],
          { children: ["(admin)", { children: ["admin", { children: ["__PAGE__", {}] }] }] },
        ],
      },
    ];
    // A soft-navigation RSC request whose router state claims the (admin)
    // layout is already mounted, so the server renders only the page. Next
    // answers the first RSC request with a 307 that adds ?_rsc=; the request
    // API follows it with the same headers.
    const layoutSkippingRsc = () =>
      page.request.get("/de/admin/users", {
        headers: {
          RSC: "1",
          "Next-Router-State-Tree": encodeURIComponent(JSON.stringify(routerState)),
        },
      });

    // Positive control: as an admin, the same request does render the user
    // list, so the crafted router state really reaches the page segment.
    await login(page, SEED.admin.email, SEED.admin.password);
    const asAdmin = await layoutSkippingRsc();
    expect(asAdmin.headers()["content-type"]).toContain("text/x-component");
    expect(await asAdmin.text()).toContain(SEED.photographer.email);
    await page.context().clearCookies();

    await login(page, SEED.client.email, SEED.client.password);
    const otherUsersEmails = [SEED.photographer.email, SEED.admin.email];
    // 1. A plain document request (the old code leaked here too: the page
    //    segment streamed after the layout's redirect).
    const html = await (await page.request.get("/de/admin/users")).text();
    // 2. The layout-skipping RSC request.
    const asClient = await layoutSkippingRsc();
    expect(asClient.headers()["content-type"]).toContain("text/x-component");
    const rsc = await asClient.text();

    for (const body of [rsc, html]) {
      for (const email of otherUsersEmails) expect(body).not.toContain(email);
    }
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

  test("non-link click inside the drawer does not close it", async ({ page }) => {
    await login(page, SEED.admin.email, SEED.admin.password);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/de/admin");

    // Open the drawer
    await page.getByTestId("admin-drawer-open").click();
    await expect(page.getByTestId("admin-drawer")).toBeVisible();

    // Click a section eyebrow label (non-interactive element inside the panel)
    // "Moderation" is the label for the third section containing Reports, Verifications, Disputes
    await page.getByTestId("admin-drawer").getByText("Moderation").click();

    // The drawer should still be visible after clicking the non-link element
    await expect(page.getByTestId("admin-drawer")).toBeVisible();
  });
});
