import { describe, expect, it } from "vitest";
import { resolveRequestConfig } from "@/i18n/request-config";

// Without a configured time zone next-intl formats dates in the runtime's
// zone: UTC on the server (Vercel), the device's zone in the browser. Swiss
// users then saw message / notification times 1–2 h off in server-rendered
// HTML, and server and client could disagree.
describe("i18n request config", () => {
  it("formats every date and time in Europe/Zurich", async () => {
    const config = await resolveRequestConfig("fr");
    expect(config.locale).toBe("fr");
    expect(config.timeZone).toBe("Europe/Zurich");
  });

  it("falls back to German for a locale we don't serve", async () => {
    const config = await resolveRequestConfig("it");
    expect(config.locale).toBe("de");
    expect(config.timeZone).toBe("Europe/Zurich");
  });
});
