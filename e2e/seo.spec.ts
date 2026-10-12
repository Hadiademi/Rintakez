// Precondition: run `npx supabase db reset` for clean seed state.
import { test, expect } from "@playwright/test";

// Technical SEO guards (no sign-in needed).
test.describe("seo", () => {
  test.setTimeout(60_000);

  test("an unknown URL shows the branded 404 in the page's language", async ({ page }) => {
    // Was Next's default English 404 with no lang attribute and no way back.
    // It must stay a real 404 for crawlers (no Suspense boundary above the
    // catch-all), not a 200 "soft 404".
    const response = await page.goto("/fr/cette-page-nexiste-pas");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const robots = await page.locator('meta[name="robots"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("content"))
    );
    expect(robots.length).toBeGreaterThan(0);
    for (const r of robots) expect(r).toContain("noindex");
    await page.getByRole("link", { name: /accueil/i }).click();
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("canton pages use the canton's own preposition and a search title", async ({ page }) => {
    await page.goto("/de/photographers/VS/wedding");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hochzeitsfotografen im Wallis");
    await expect(page).toHaveTitle("Hochzeitsfotografen im Wallis – Offerten vergleichen — Framly");

    await page.goto("/fr/photographers/TI/portrait");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Photographes de portrait au Tessin");
  });

  test("the home page has a search title and hreflang incl. x-default", async ({ page }) => {
    await page.goto("/de");
    await expect(page).toHaveTitle("Fotograf in der Schweiz finden – Offerten vergleichen | Framly");
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/de$/);
    await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveCount(1);
  });

  // Review UI-04: logged-out visitors on the directory, shoot, profile,
  // canton and pricing pages had no footer, so no Impressum / Datenschutz /
  // AGB link on the pages search traffic lands on.
  test("public marketplace pages show the legal footer to visitors", async ({ page }) => {
    for (const path of ["/de/photographers", "/de/shoots", "/de/pricing", "/de/photographers/ZH/event"]) {
      await page.goto(path);
      const footer = page.locator("footer");
      await expect(footer.getByRole("link", { name: "Impressum" }), path).toBeVisible();
      await expect(footer.locator('a[href$="/datenschutz"]'), path).toHaveCount(1);
      await expect(footer.locator('a[href$="/agb"]'), path).toHaveCount(1);
    }
  });

  test("the sitemap lists the contact page", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/de/contact</loc>");
    expect(xml).toContain("/fr/contact</loc>");
  });
});
