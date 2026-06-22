import { describe, expect, it } from "vitest";
import { photographerDetailsSchema } from "./photographer";

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
