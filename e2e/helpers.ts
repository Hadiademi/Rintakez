// Shared E2E helpers. Precondition: `npx supabase db reset` for clean seed state
// (the CI e2e job does this). Seed users all use password "password123"; the
// seeded platform admin uses the strong password baked into supabase/seed.sql.
import { expect, type Page } from "@playwright/test";

export const SEED = {
  client: { email: "lena@example.ch", password: "password123" },
  // A second seeded client. Specs that only need "a client" use it so the
  // suite stays under the per-email sign-in limit (Supabase + our own
  // limiter count logins per address).
  client2: { email: "vitra@example.ch", password: "password123" },
  photographer: { email: "marko@example.ch", password: "password123" },
  admin: { email: "admin@framly.ch", password: "gzOuYKoDplFbJWNqtdJyAa1!" },
};

export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/de/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/de\/home/, { timeout: 20_000 });
  await expect(page.getByTestId("sign-out")).toBeVisible({ timeout: 20_000 });
}

export function futureDate(): string {
  const year = new Date().getFullYear() + 1;
  return `${year}-09-15`;
}

/**
 * Confirms the branded confirmation sheet (it replaced window.confirm, so
 * Playwright's "dialog" event no longer fires).
 */
export async function confirmDialog(page: Page): Promise<void> {
  const dialog = page.getByTestId("confirm-dialog");
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await dialog.getByTestId("confirm-ok").click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

/**
 * Waits for a celebration moment (optionally checking its text) and closes it
 * with Escape — it is modal, so the page behind can't be clicked until then.
 */
export async function closeMoment(page: Page, text?: string | RegExp): Promise<void> {
  const moment = page.getByTestId("moment");
  await expect(moment).toBeVisible({ timeout: 20_000 });
  if (text) await expect(moment).toContainText(text);
  await page.keyboard.press("Escape");
  await expect(moment).toBeHidden({ timeout: 20_000 });
}

