// A brand-new photographer completes onboarding the way a real one tried to
// and could not: website typed as "www.…" (no https://), one Instagram per
// field, a Sport specialty that did not exist. Before the fix the form refused
// with a single generic "Bitte überprüfe deine Eingaben." and no hint which
// field was wrong.
//
// Registers its own account (unique email, auto-confirmed locally — see
// supabase/config.toml), so it never touches the seeded photographers other
// specs rely on.
import { test, expect } from "@playwright/test";
import { closeMoment } from "./helpers";

const PASSWORD = "password123";

function uniqueEmail() {
  return `pro-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.ch`;
}

test.describe("photographer onboarding", () => {
  test.setTimeout(120_000);

  test("accepts www. links, labelled per field, plus Sport — and points at a bad link", async ({
    page,
  }) => {
    const email = uniqueEmail();

    await page.goto("/de/register");
    await page.getByTestId("register-displayName").fill("Michèle Test");
    await page.getByTestId("register-email").fill(email);
    await page.getByTestId("register-password").fill(PASSWORD);
    await page.getByTestId("register-role-photographer").click();
    await page.getByTestId("register-accept-terms").check();
    await page.getByTestId("register-submit").click();
    await expect(page).toHaveURL(/\/de\/login(\?|$)/, { timeout: 20_000 });

    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    // A photographer without details is sent to onboarding.
    await expect(page).toHaveURL(/\/de\/onboarding/, { timeout: 20_000 });

    const specialties = page.getByTestId("onboarding-specialties");
    await specialties.getByRole("button", { name: "Sport", exact: true }).click();
    await specialties.getByRole("button", { name: "Hochzeit", exact: true }).click();
    await page
      .getByTestId("onboarding-cantons")
      .getByRole("button", { name: "Luzern", exact: true })
      .click();

    await page.getByTestId("onboarding-link-label-0").fill("Sport");
    await page.getByTestId("onboarding-link-url-0").fill("www.myrensport.com");
    await page.getByTestId("onboarding-add-link").click();
    await page.getByTestId("onboarding-link-label-1").fill("Sport");
    await page
      .getByTestId("onboarding-link-url-1")
      .fill("https://www.instagram.com/myren.sports");
    await page.getByTestId("onboarding-add-link").click();
    await page.getByTestId("onboarding-link-label-2").fill("Hochzeit");
    await page.getByTestId("onboarding-link-url-2").fill("not a link");

    // A bad link is named on its own row, and only that row.
    await page.getByTestId("onboarding-finish").click();
    await expect(page.getByTestId("onboarding-link-url-2")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page.getByTestId("onboarding-link-url-2")).toBeFocused();
    await expect(page.getByTestId("onboarding-link-url-0")).not.toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page).toHaveURL(/\/de\/onboarding/);

    // Fixing it (an @handle is fine) lets the photographer through.
    await page.getByTestId("onboarding-link-url-2").fill("@myren.weddings");
    await expect(page.getByTestId("onboarding-link-url-2")).not.toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await page.getByTestId("onboarding-finish").click();
    await expect(page).toHaveURL(/\/de\/home/, { timeout: 20_000 });
    await closeMoment(page);

    // The public profile shows the Sport specialty and the labelled links,
    // normalised to full https URLs. Reached via the settings page's own
    // "view public profile" link.
    await page.goto("/de/profile");
    const href = await page
      .locator('a[href*="/de/photographers/"]')
      .first()
      .getAttribute("href");
    expect(href).toMatch(/\/de\/photographers\/[0-9a-f-]{36}$/);
    await page.goto(href!);

    await expect(page.getByText("Sport", { exact: true }).first()).toBeVisible();
    const site = page.locator('a[href="https://www.myrensport.com"]');
    await expect(site).toBeVisible();
    await expect(site).toHaveAttribute("rel", /nofollow/);
    await expect(site).toContainText("myrensport.com");
    await expect(
      page.locator('a[href="https://www.instagram.com/myren.weddings"]')
    ).toContainText("@myren.weddings");
  });
});
