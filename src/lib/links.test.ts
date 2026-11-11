import { describe, expect, it } from "vitest";
import {
  MAX_LINKS,
  legacyLinkColumns,
  platformName,
  toLinkPayload,
  linkDisplay,
  normalizeLinkUrl,
  resolveLinks,
} from "@/lib/links";

describe("normalizeLinkUrl", () => {
  // The bug a real photographer hit: she typed her site the way everyone does,
  // without a scheme, and onboarding refused it with a generic error.
  it("accepts a site typed without https:// and adds it", () => {
    expect(normalizeLinkUrl("www.myrensport.com")).toBe("https://www.myrensport.com");
    expect(normalizeLinkUrl("myrensport.com")).toBe("https://myrensport.com");
    expect(normalizeLinkUrl("  myrensport.ch/hochzeit  ")).toBe(
      "https://myrensport.ch/hochzeit"
    );
  });

  it("keeps an explicit http or https scheme", () => {
    expect(normalizeLinkUrl("https://www.myrensport.com")).toBe("https://www.myrensport.com");
    expect(normalizeLinkUrl("http://old-site.ch")).toBe("http://old-site.ch");
    expect(normalizeLinkUrl("HTTPS://Example.ch")).toBe("https://Example.ch");
  });

  it("turns an @handle into an Instagram URL", () => {
    expect(normalizeLinkUrl("@myren.sports")).toBe("https://www.instagram.com/myren.sports");
    expect(normalizeLinkUrl("@Anna_Foto")).toBe("https://www.instagram.com/Anna_Foto");
  });

  it("accepts instagram.com links typed without a scheme", () => {
    expect(normalizeLinkUrl("instagram.com/myren.sports")).toBe(
      "https://instagram.com/myren.sports"
    );
  });

  it("returns null for empty input", () => {
    expect(normalizeLinkUrl("")).toBeNull();
    expect(normalizeLinkUrl("   ")).toBeNull();
  });

  it("rejects things that are not web links", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<b>x</b>",
      "mailto:anna@example.ch",
      "ftp://files.example.ch",
      "my website",
      "localhost",
      "https://localhost",
      "https://192.168.1.1",
      "@",
      "@has space",
      "www.",
      "https://",
    ]) {
      expect(normalizeLinkUrl(bad), bad).toBeNull();
    }
  });

  it("rejects overly long links", () => {
    expect(normalizeLinkUrl(`https://example.ch/${"a".repeat(400)}`)).toBeNull();
  });
});

describe("linkDisplay", () => {
  it("shows an Instagram link as its @handle", () => {
    expect(
      linkDisplay({ url: "https://www.instagram.com/myren.sports/", label: null })
    ).toEqual({ kind: "instagram", text: "@myren.sports", label: null });
  });

  it("shows a website as its host without www", () => {
    expect(
      linkDisplay({ url: "https://www.myrensport.com/portfolio", label: "Sport" })
    ).toEqual({ kind: "website", text: "myrensport.com", label: "Sport" });
  });

  it("recognises the common video and social platforms", () => {
    expect(linkDisplay({ url: "https://www.youtube.com/@anna", label: null }).kind).toBe(
      "youtube"
    );
    expect(linkDisplay({ url: "https://vimeo.com/anna", label: null }).kind).toBe("vimeo");
    expect(linkDisplay({ url: "https://www.tiktok.com/@anna", label: null }).kind).toBe(
      "tiktok"
    );
  });
});

describe("resolveLinks", () => {
  it("prefers the links list when present", () => {
    expect(
      resolveLinks({
        links: [{ url: "https://a.ch", label: "Sport" }],
        website_url: "https://legacy.ch",
        instagram_url: null,
      })
    ).toEqual([{ url: "https://a.ch", label: "Sport" }]);
  });

  // Covers the deploy window and a rollback: a row edited by the previous
  // release has only the legacy columns filled.
  it("falls back to the legacy website/instagram columns when the list is empty", () => {
    expect(
      resolveLinks({
        links: [],
        website_url: "https://legacy.ch",
        instagram_url: "https://instagram.com/legacy",
      })
    ).toEqual([
      { url: "https://legacy.ch", label: null },
      { url: "https://instagram.com/legacy", label: null },
    ]);
  });

  it("drops malformed entries instead of rendering them", () => {
    expect(
      resolveLinks({
        links: [{ url: "javascript:alert(1)", label: null }, { nope: true }, "x"],
        website_url: null,
        instagram_url: null,
      })
    ).toEqual([]);
  });

  it("never returns more than the maximum", () => {
    const many = Array.from({ length: MAX_LINKS + 3 }, (_, i) => ({
      url: `https://site${i}.ch`,
      label: null,
    }));
    expect(
      resolveLinks({ links: many, website_url: null, instagram_url: null })
    ).toHaveLength(MAX_LINKS);
  });

  it("returns an empty list for a missing row", () => {
    expect(resolveLinks(null)).toEqual([]);
  });
});

describe("legacyLinkColumns", () => {
  it("mirrors the first website and the first Instagram link", () => {
    expect(
      legacyLinkColumns([
        { url: "https://www.instagram.com/myren.sports", label: "Sport" },
        { url: "https://www.myrensport.com", label: "Sport" },
        { url: "https://myren-weddings.ch", label: "Hochzeit" },
      ])
    ).toEqual({
      website_url: "https://www.myrensport.com",
      instagram_url: "https://www.instagram.com/myren.sports",
    });
  });

  it("clears both when there are no links", () => {
    expect(legacyLinkColumns([])).toEqual({ website_url: null, instagram_url: null });
  });
});

describe("toLinkPayload", () => {
  it("skips fully empty rows but remembers which row each link came from", () => {
    expect(
      toLinkPayload([
        { label: "", url: "" },
        { label: "Sport", url: "www.myrensport.com" },
        { label: "  ", url: "   " },
        { label: "Hochzeit", url: "@myren.weddings" },
      ])
    ).toEqual({
      payload: [
        { label: "Sport", url: "www.myrensport.com" },
        { label: "Hochzeit", url: "@myren.weddings" },
      ],
      rowOf: [1, 3],
    });
  });

  // A name without a link is kept, so validation can point at that row
  // ("you named a link but left it empty") instead of silently dropping it.
  it("keeps a row that has a name but no link", () => {
    expect(toLinkPayload([{ label: "Sport", url: "" }])).toEqual({
      payload: [{ label: "Sport", url: "" }],
      rowOf: [0],
    });
  });
});

describe("platformName", () => {
  it("names the platforms and returns null for a plain website", () => {
    expect(platformName("instagram")).toBe("Instagram");
    expect(platformName("youtube")).toBe("YouTube");
    expect(platformName("website")).toBeNull();
  });
});
