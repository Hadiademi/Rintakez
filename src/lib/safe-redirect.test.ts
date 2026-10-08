import { describe, expect, it } from "vitest";
import { safeLocale, safeRedirectTarget } from "@/lib/safe-redirect";

const ORIGIN = "https://framly.ch";
const FALLBACK = "/de/home";

describe("safeRedirectTarget", () => {
  it("keeps a relative path, with its query and hash", () => {
    const target = safeRedirectTarget("/de/messages/1?a=2#top", ORIGIN, FALLBACK);
    expect(target.origin).toBe(ORIGIN);
    expect(target.pathname).toBe("/de/messages/1");
    expect(target.search).toBe("?a=2");
    expect(target.hash).toBe("#top");
  });

  it("keeps an absolute URL that is already on this origin", () => {
    const target = safeRedirectTarget(`${ORIGIN}/de/profile`, ORIGIN, FALLBACK);
    expect(target.href).toBe(`${ORIGIN}/de/profile`);
  });

  // The bug this module exists for: `new URL(raw, origin)` lets an absolute
  // `raw` override the base entirely.
  it("rejects an absolute URL pointing at another origin", () => {
    const target = safeRedirectTarget("https://evil.example/steal", ORIGIN, FALLBACK);
    expect(target.href).toBe(`${ORIGIN}${FALLBACK}`);
  });

  it("rejects a protocol-relative URL", () => {
    const target = safeRedirectTarget("//evil.example/steal", ORIGIN, FALLBACK);
    expect(target.href).toBe(`${ORIGIN}${FALLBACK}`);
  });

  it("rejects a javascript: scheme", () => {
    const target = safeRedirectTarget("javascript:alert(1)", ORIGIN, FALLBACK);
    expect(target.href).toBe(`${ORIGIN}${FALLBACK}`);
  });

  it("rejects a data: scheme", () => {
    const target = safeRedirectTarget("data:text/html,<script>", ORIGIN, FALLBACK);
    expect(target.href).toBe(`${ORIGIN}${FALLBACK}`);
  });

  it("rejects an http downgrade of the same host", () => {
    const target = safeRedirectTarget("http://framly.ch/de/home", ORIGIN, FALLBACK);
    expect(target.href).toBe(`${ORIGIN}${FALLBACK}`);
  });

  it("falls back on null, undefined and empty input", () => {
    for (const raw of [null, undefined, ""]) {
      expect(safeRedirectTarget(raw, ORIGIN, FALLBACK).href).toBe(
        `${ORIGIN}${FALLBACK}`
      );
    }
  });

  it("works against a localhost origin (dev parity)", () => {
    const dev = "http://localhost:3000";
    expect(safeRedirectTarget("/de/home", dev, FALLBACK).origin).toBe(dev);
    expect(safeRedirectTarget("https://evil.example", dev, FALLBACK).href).toBe(
      `${dev}${FALLBACK}`
    );
  });
});

describe("safeLocale", () => {
  it("passes through every locale the app serves", () => {
    for (const locale of ["de", "fr", "en"]) {
      expect(safeLocale(locale)).toBe(locale);
    }
  });

  it("falls back to the default locale for anything else", () => {
    for (const raw of [null, undefined, "", "xx", "de-CH", "../../etc", "https://evil.example"]) {
      expect(safeLocale(raw)).toBe("de");
    }
  });
});
