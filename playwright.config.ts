import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Run serially with a single worker: several specs sign in as the same
  // seed user, and Supabase local has refresh-token rotation enabled
  // (enable_refresh_token_rotation = true). Concurrent logins as one user
  // rotate each other's tokens, so the middleware sees an invalid session
  // and bounces to /login. One worker keeps logins sequential and also
  // avoids dev-server cold-compile contention.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? { NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL }
        : {}),
      ...(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? {
            NEXT_PUBLIC_SUPABASE_ANON_KEY:
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          }
        : {}),
    },
  },
});
