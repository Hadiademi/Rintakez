import { describe, expect, it } from "vitest";
import { photographerDetailsSchema } from "./photographer";

describe("photographerDetailsSchema", () => {
  it("accepts a valid payload with required fields only", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      coverageCantons: ["ZH"],
      hourlyRateChf: 280,
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty specialties", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: [],
      coverageCantons: ["ZH"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects hourlyRateChf of 0", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["portrait"],
      coverageCantons: ["BE"],
      hourlyRateChf: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative hourlyRateChf", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["portrait"],
      coverageCantons: ["BE"],
      hourlyRateChf: -50,
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown canton", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["event"],
      coverageCantons: ["XX"],
    });
    expect(r.success).toBe(false);
  });

  it("accepts omitted hourlyRateChf", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["commercial"],
      coverageCantons: ["GE"],
    });
    expect(r.success).toBe(true);
  });

  it("accepts omitted websiteUrl", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["family"],
      coverageCantons: ["VD"],
    });
    expect(r.success).toBe(true);
  });

  it("accepts empty-string websiteUrl (treated as optional)", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["wedding"],
      coverageCantons: ["ZH"],
      websiteUrl: "",
    });
    expect(r.success).toBe(true);
  });

  it("accepts empty-string instagramUrl", () => {
    const r = photographerDetailsSchema.safeParse({
      specialties: ["architecture"],
      coverageCantons: ["BS"],
      instagramUrl: "",
    });
    expect(r.success).toBe(true);
  });
});
