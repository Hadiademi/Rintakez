// Precondition: run `npx supabase db reset` for clean seed state (CI e2e job does this).
import { test, expect } from "@playwright/test";
import { SEED, login, futureDate } from "./helpers";

// Regression for review UI-01: the wizard's "Weiter" and "Veröffentlichen"
// buttons shared one DOM slot, so the click that advanced from step 2 to step 3
// was also processed as a submit. Step 3 opened covered in validation errors,
// and going Back then Next published the shoot without the user pressing
// "Veröffentlichen".
test.describe("new-shoot wizard", () => {
  test.setTimeout(90_000);

  test("advancing never submits: step 3 opens clean, Back then Next stays on the form", async ({
    page,
  }) => {
    await login(page, SEED.client2.email, SEED.client2.password);
    await page.goto("/de/shoots/new");

    // A draft left by an earlier run would restore a later step; start clean.
    const discard = page.getByTestId("shoot-draft-discard");
    if (await discard.isVisible().catch(() => false)) await discard.click();

    await page.getByTestId("shoot-type-portrait").click();
    await page.getByTestId("shoot-next").click();

    // Cantons are listed by name in the page's language, not by code.
    const canton = page.getByTestId("shoot-canton");
    await expect(canton.locator('option[value="VS"]')).toHaveText("Wallis");
    await expect(canton.locator('option[value="GE"]')).toHaveText("Genf");

    await page.getByTestId("shoot-city").fill("Bern");
    await page.getByTestId("shoot-postcode").fill("3011");
    await page.getByTestId("shoot-canton").selectOption("BE");
    await page.getByTestId("shoot-date").fill(futureDate());
    await page.getByTestId("shoot-duration").fill("2");
    await page.getByTestId("shoot-next").click();

    const form = page.locator("form");
    const fieldErrors = form.locator("p.text-accent");

    // Step 3 is open and untouched: no validation errors yet. Focus moved to
    // the new step's heading (the clicked button no longer exists).
    await expect(page.getByTestId("shoot-title")).toBeVisible();
    await expect(fieldErrors).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

    // Back to step 2 and forward again: still the form, still no errors.
    await page.getByTestId("shoot-back").click();
    await expect(page.getByTestId("shoot-city")).toBeVisible();
    await page.getByTestId("shoot-next").click();
    await expect(page.getByTestId("shoot-title")).toBeVisible();
    await page.waitForTimeout(1500); // a stray submit would navigate or render errors by now
    await expect(page).toHaveURL(/\/de\/shoots\/new$/);
    await expect(fieldErrors).toHaveCount(0);
  });

  // "Weiter" and "Veröffentlichen" sit in the same spot, so the second click of
  // a double-click on step 2 lands on Publish. With step 3 already filled (the
  // user went Back to fix something) that published the shoot.
  test("double-clicking Weiter on step 2 never publishes", async ({ page }) => {
    await login(page, SEED.client2.email, SEED.client2.password);
    await page.goto("/de/shoots/new");
    const discard = page.getByTestId("shoot-draft-discard");
    if (await discard.isVisible().catch(() => false)) await discard.click();

    await page.getByTestId("shoot-type-portrait").click();
    await page.getByTestId("shoot-next").click();
    await page.getByTestId("shoot-city").fill("Basel");
    await page.getByTestId("shoot-canton").selectOption("BS");
    await page.getByTestId("shoot-date").fill(futureDate());
    await page.getByTestId("shoot-duration").fill("2");
    await page.getByTestId("shoot-next").click();
    await page.getByTestId("shoot-title").fill("Doppelklick-Test");
    await page.getByTestId("shoot-brief").fill("Dieser Auftrag darf nicht veröffentlicht werden.");
    await page.getByTestId("shoot-budget-min").fill("300");
    await page.getByTestId("shoot-budget-max").fill("600");

    await page.getByTestId("shoot-back").click();
    // A human double-click: two clicks on the same spot ~150 ms apart, so the
    // second one lands on whatever button is there by then.
    const box = (await page.getByTestId("shoot-next").boundingBox())!;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
    await page.mouse.click(x, y);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/de\/shoots\/new$/);
    await expect(page.getByTestId("shoot-title")).toHaveValue("Doppelklick-Test");
  });

  // A draft restored on the last step can carry a value that is no longer
  // valid (here: a date that has passed). Publishing used to do nothing
  // visible, because the failing field sits on an earlier step.
  test("publishing with an invalid earlier step jumps to that step and says why", async ({ page }) => {
    await login(page, SEED.client2.email, SEED.client2.password);
    await page.goto("/de/shoots/new");
    await page.evaluate(() => {
      localStorage.setItem(
        "rintakez:shoot-draft:a0000000-0000-0000-0000-000000000002",
        JSON.stringify({
          step: 2,
          values: {
            discipline: "photo", type: "portrait", locationCity: "Chur", canton: "GR",
            shootDate: "2020-01-01", durationHours: 2, title: "Alter Entwurf",
            brief: "Ein Entwurf mit einem Datum, das inzwischen vorbei ist.",
            budgetMinChf: 300, budgetMaxChf: 600,
          },
        })
      );
    });
    await page.reload();
    await expect(page.getByTestId("shoot-title")).toHaveValue("Alter Entwurf");

    await page.getByTestId("shoot-submit").click();
    await expect(page.getByTestId("shoot-date")).toBeVisible();
    await expect(page.getByText("Das Datum darf nicht in der Vergangenheit liegen.")).toBeVisible();
    await expect(page).toHaveURL(/\/de\/shoots\/new$/);
  });

  // Regression for review OPS-02: reference photos were uploaded as originals.
  // A current phone photo (5–8 MB) exceeded the upload limit, so the shoot was
  // created without it. They are now downscaled in the browser like every
  // other upload.
  test("a phone-sized reference photo (>5 MB) reaches the shoot", async ({ page }) => {
    await login(page, SEED.client2.email, SEED.client2.password);
    await page.goto("/de/shoots/new");
    const discard = page.getByTestId("shoot-draft-discard");
    if (await discard.isVisible().catch(() => false)) await discard.click();

    await page.getByTestId("shoot-type-event").click();
    await page.getByTestId("shoot-next").click();
    await page.getByTestId("shoot-city").fill("Luzern");
    await page.getByTestId("shoot-canton").selectOption("LU");
    await page.getByTestId("shoot-date").fill(futureDate());
    await page.getByTestId("shoot-duration").fill("3");
    await page.getByTestId("shoot-next").click();
    await page.getByTestId("shoot-title").fill(`E2E Grosses Foto ${Date.now()}`);
    await page.getByTestId("shoot-brief").fill("Referenzbild direkt vom Handy, unverkleinert.");
    await page.getByTestId("shoot-budget-min").fill("500");
    await page.getByTestId("shoot-budget-max").fill("900");

    // A noisy 3000×2250 JPEG compresses about as badly as a real 24 MP photo.
    const base64 = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 3000;
      canvas.height = 2250;
      const ctx = canvas.getContext("2d")!;
      const img = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = (Math.random() * 256) | 0;
        img.data[i + 1] = (Math.random() * 256) | 0;
        img.data[i + 2] = (Math.random() * 256) | 0;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.95));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(bin);
    });
    const photo = Buffer.from(base64, "base64");
    expect(photo.length).toBeGreaterThan(5 * 1024 * 1024);
    await page.getByTestId("shoot-references-input").setInputFiles({
      name: "IMG_0001.jpg",
      mimeType: "image/jpeg",
      buffer: photo,
    });

    await page.getByTestId("shoot-submit").click();
    await expect(page).toHaveURL(/\/de\/shoots\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByTestId("ref-upload-warning")).toHaveCount(0);
    await expect(page.locator('img[src*="shoot-refs"]').first()).toBeVisible();
  });
});
