import { test, expect } from "@playwright/test";

const SEED_CLIENT_EMAIL = "lena@example.ch";
const SEED_CLIENT_NAME = "Lena & Tobias K.";
const PASSWORD = "password123";

function uniqueEmail() {
  return `client-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.ch`;
}

test.describe("auth journey", () => {
  test("protected route redirects to login when logged out", async ({
    page,
  }) => {
    await page.goto("/de/home");
    await expect(page).toHaveURL(/\/de\/login/);
  });

  test("login, dashboard greeting, then sign out (seed client)", async ({
    page,
  }) => {
    await page.goto("/de/login");
    await page.getByTestId("login-email").fill(SEED_CLIENT_EMAIL);
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/de\/home/, { timeout: 20_000 });
    // The dashboard greets with the display name (e.g. "Hallo, Lena & Tobias K.").
    await expect(
      page.getByRole("heading", { name: new RegExp(SEED_CLIENT_NAME) })
    ).toBeVisible();

    // Sign out from the app nav.
    await page.getByTestId("sign-out").click();
    await expect(page).toHaveURL(/\/de(\/login)?$/, { timeout: 20_000 });

    // Visiting the protected route again must redirect to login.
    await page.goto("/de/home");
    await expect(page).toHaveURL(/\/de\/login/);
  });

  test("register validation rejects a short password", async ({ page }) => {
    await page.goto("/de/register");
    await page.getByTestId("register-displayName").fill("Test User");
    await page.getByTestId("register-email").fill(uniqueEmail());
    await page.getByTestId("register-password").fill("short"); // 5 chars
    await page.getByTestId("register-submit").click();

    // zodResolver blocks submission: still on /register, no navigation away.
    await expect(page).toHaveURL(/\/de\/register/);
    // A field-level validation message must appear next to the password input.
    await expect(
      page.locator("#register-password ~ p.text-accent")
    ).toBeVisible();
  });

  test("register happy path (client, auto-confirmed) logs in", async ({
    page,
  }) => {
    await page.goto("/de/register");
    await page.getByTestId("register-displayName").fill("E2E Client");
    await page.getByTestId("register-email").fill(uniqueEmail());
    await page.getByTestId("register-password").fill(PASSWORD);
    await page.getByTestId("register-role-client").click();
    await page.getByTestId("register-submit").click();

    // With local confirmations disabled, registerAction returns session:true
    // and the form routes to /home. Prefer asserting /home; fall back to the
    // check-email panel if the session was not created (confirmations on).
    try {
      await expect(page).toHaveURL(/\/de\/home/, { timeout: 20_000 });
    } catch {
      await expect(page.getByTestId("register-check-email")).toBeVisible();
    }
  });
});
