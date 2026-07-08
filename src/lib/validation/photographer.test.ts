import { describe, expect, it } from "vitest";
import {
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

  it("accepts empty-string websiteUrl (treated as optional)", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      disciplines: ["photo"],
      coverageCantons: ["ZH"],
      websiteUrl: "",
    });
    expect(r.success).toBe(true);
  });

  it("accepts empty-string instagramUrl", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["architecture"],
      disciplines: ["photo"],
      coverageCantons: ["BS"],
      instagramUrl: "",
    });
    expect(r.success).toBe(true);
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
