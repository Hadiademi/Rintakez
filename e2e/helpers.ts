// Shared E2E helpers. Precondition: `npx supabase db reset` for clean seed state
// (the CI e2e job does this). Seed users all use password "password123"; the
// seeded platform admin uses the strong password baked into supabase/seed.sql.
import { expect, type Page } from "@playwright/test";

export const SEED = {
  client: { email: "lena@example.ch", password: "password123" },
  photographer: { email: "marko@example.ch", password: "password123" },
  admin: { email: "admin@rintakez.ch", password: "gzOuYKoDplFbJWNqtdJyAa1!" },
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
