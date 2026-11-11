import { describe, expect, it } from "vitest";
import {
  checkDetailsForm,
  detailsFieldErrors,
  photographerDetailsSchema,
  reorderPortfolioSchema,
  portfolioCaptionSchema,
} from "./photographer";

const UUID_A = "a1b2c3d4-1111-4222-8333-444455556666";
const UUID_B = "b1b2c3d4-2222-4333-8444-555566667777";

describe("photographerDetailsSchema", () => {
  it("accepts a valid payload with required fields only", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      disciplines: ["photo"],
      coverageCantons: ["ZH"],
      hourlyRateChf: 280,
    });
    expect(r.success).toBe(true);
  });

  it("accepts both disciplines (photo + video)", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      disciplines: ["photo", "video"],
      coverageCantons: ["ZH"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty disciplines", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      disciplines: [],
      coverageCantons: ["ZH"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty specialties", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: [],
      disciplines: ["photo"],
      coverageCantons: ["ZH"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects hourlyRateChf of 0", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["portrait"],
      disciplines: ["photo"],
      coverageCantons: ["BE"],
      hourlyRateChf: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative hourlyRateChf", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["portrait"],
      disciplines: ["photo"],
      coverageCantons: ["BE"],
      hourlyRateChf: -50,
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown canton", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["event"],
      disciplines: ["photo"],
      coverageCantons: ["XX"],
    });
    expect(r.success).toBe(false);
  });

  it("accepts omitted hourlyRateChf", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["commercial"],
      disciplines: ["video"],
      coverageCantons: ["GE"],
    });
    expect(r.success).toBe(true);
  });

  it("accepts the sport specialty", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["sport", "wedding"],
      disciplines: ["photo"],
      coverageCantons: ["LU"],
    });
    expect(r.success).toBe(true);
  });

  it("defaults links to an empty list", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      disciplines: ["photo"],
      coverageCantons: ["ZH"],
    });
    expect(r.success && r.data.links).toEqual([]);
  });

  // The exact onboarding a photographer could not finish: site typed without
  // https://, Instagram as a full URL, separate presences for sport and weddings.
  it("accepts and normalises labelled links typed the way people type them", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["sport", "wedding"],
      disciplines: ["photo"],
      coverageCantons: ["LU"],
      hourlyRateChf: 250,
      links: [
        { url: "www.myrensport.com", label: "Sport" },
        { url: "https://www.instagram.com/myren.sports", label: " Sport " },
        { url: "@myren.weddings", label: "Hochzeit" },
        { url: "myren-weddings.ch", label: "" },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.links).toEqual([
      { url: "https://www.myrensport.com", label: "Sport" },
      { url: "https://www.instagram.com/myren.sports", label: "Sport" },
      { url: "https://www.instagram.com/myren.weddings", label: "Hochzeit" },
      { url: "https://myren-weddings.ch", label: null },
    ]);
  });

  it("rejects a link that is not a web address, pointing at that row", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      disciplines: ["photo"],
      coverageCantons: ["ZH"],
      links: [
        { url: "www.ok.ch", label: null },
        { url: "javascript:alert(1)", label: null },
      ],
    });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues.map((i) => i.path)).toEqual([["links", 1, "url"]]);
  });

  it("rejects more than six links", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      disciplines: ["photo"],
      coverageCantons: ["ZH"],
      links: Array.from({ length: 7 }, (_, i) => ({ url: `site${i}.ch`, label: null })),
    });
    expect(r.success).toBe(false);
  });

  it("rejects an overlong label", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      disciplines: ["photo"],
      coverageCantons: ["ZH"],
      links: [{ url: "site.ch", label: "x".repeat(41) }],
    });
    expect(r.success).toBe(false);
  });
});

describe("detailsFieldErrors", () => {
  function issuesFor(raw: unknown) {
    const r = photographerDetailsSchema.safeParse(raw);
    return r.success ? [] : r.error.issues;
  }
  const base = { specialties: ["wedding"], disciplines: ["photo"], coverageCantons: ["ZH"] };

  it("maps a bad link to its row", () => {
    expect(
      detailsFieldErrors(
        issuesFor({ ...base, links: [{ url: "ok.ch" }, { url: "not a link" }] })
      )
    ).toEqual({ links: { 1: "invalid_link" }, general: false });
  });

  it("maps an overlong label to its row", () => {
    expect(
      detailsFieldErrors(issuesFor({ ...base, links: [{ url: "ok.ch", label: "x".repeat(41) }] }))
    ).toEqual({ links: { 0: "invalid_link_label" }, general: false });
  });

  // A decimal rate (e.g. "250.50" typed into the number field) used to fail
  // the .int() check and surface as the same generic error.
  it("maps a non-integer hourly rate to the rate field", () => {
    expect(detailsFieldErrors(issuesFor({ ...base, hourlyRateChf: 250.5 }))).toEqual({
      hourlyRate: "invalid_rate",
      links: {},
      general: false,
    });
  });

  it("flags anything it cannot place as general", () => {
    expect(detailsFieldErrors(issuesFor({ ...base, specialties: [] }))).toEqual({
      links: {},
      general: true,
    });
  });
});

describe("reorderPortfolioSchema", () => {
  it("accepts a non-empty list of uuids", () => {
    const r = reorderPortfolioSchema.safeParse([UUID_A, UUID_B]);
    expect(r.success).toBe(true);
  });

  it("rejects an empty list", () => {
    expect(reorderPortfolioSchema.safeParse([]).success).toBe(false);
  });

  it("rejects a non-uuid entry", () => {
    expect(reorderPortfolioSchema.safeParse([UUID_A, "nope"]).success).toBe(
      false
    );
  });

  it("rejects more than 20 ids (portfolio cap)", () => {
    const many = Array.from({ length: 21 }, () => UUID_A);
    expect(reorderPortfolioSchema.safeParse(many).success).toBe(false);
  });
});

describe("portfolioCaptionSchema", () => {
  it("accepts a caption within range", () => {
    const r = portfolioCaptionSchema.safeParse({
      imageId: UUID_A,
      caption: "Golden hour",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.caption).toBe("Golden hour");
  });

  it("trims surrounding whitespace", () => {
    const r = portfolioCaptionSchema.safeParse({
      imageId: UUID_A,
      caption: "  spaced  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.caption).toBe("spaced");
  });

  it("coerces an empty/whitespace caption to null (clear)", () => {
    const r = portfolioCaptionSchema.safeParse({
      imageId: UUID_A,
      caption: "   ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.caption).toBeNull();
  });

  it("accepts an explicit null caption", () => {
    const r = portfolioCaptionSchema.safeParse({
      imageId: UUID_A,
      caption: null,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.caption).toBeNull();
  });

  it("rejects a caption longer than 280 chars", () => {
    const r = portfolioCaptionSchema.safeParse({
      imageId: UUID_A,
      caption: "x".repeat(281),
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-uuid imageId", () => {
    const r = portfolioCaptionSchema.safeParse({
      imageId: "nope",
      caption: "hi",
    });
    expect(r.success).toBe(false);
  });
});

describe("checkDetailsForm", () => {
  const base = { specialties: ["wedding"], disciplines: ["photo"], coverageCantons: ["ZH"] };

  it("passes a valid form", () => {
    expect(checkDetailsForm({ ...base, links: [{ url: "www.a.ch", label: "" }] }, [0])).toEqual({
      ok: true,
    });
  });

  // Empty editor rows are dropped before validation, so payload index 0 can be
  // editor row 2 — the error must land on the row the photographer sees.
  it("maps link errors back to the editor row", () => {
    expect(
      checkDetailsForm(
        { ...base, links: [{ url: "www.ok.ch" }, { url: "not a link" }] },
        [0, 2]
      )
    ).toEqual({ ok: false, links: { 2: "invalid_link" }, general: false });
  });
});
