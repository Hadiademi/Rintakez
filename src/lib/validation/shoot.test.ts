import { describe, expect, it } from "vitest";
import { createShootSchema } from "./shoot";

const valid = {
  title: "Hochzeit in Zermatt",
  type: "wedding",
  brief: "Dokumentarischer Stil im Detail beschrieben.",
  locationCity: "Zermatt",
  locationPostcode: "3920",
  canton: "VS",
  shootDate: "2099-08-14",
  durationHours: 10,
  budgetMinChf: 3200,
  budgetMaxChf: 4500,
};

describe("createShootSchema", () => {
  it("accepts a valid payload", () => {
    const r = createShootSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects title length 2", () => {
    const r = createShootSchema.safeParse({ ...valid, title: "AB" });
    expect(r.success).toBe(false);
  });

  it("rejects brief shorter than 10 chars", () => {
    const r = createShootSchema.safeParse({ ...valid, brief: "Too short" });
    expect(r.success).toBe(false);
  });

  it("rejects budgetMaxChf less than budgetMinChf", () => {
    const r = createShootSchema.safeParse({ ...valid, budgetMaxChf: 1000, budgetMinChf: 2000 });
    expect(r.success).toBe(false);
  });

  it("rejects unknown canton XX", () => {
    const r = createShootSchema.safeParse({ ...valid, canton: "XX" });
    expect(r.success).toBe(false);
  });

  it("rejects postcode '39' (too short)", () => {
    const r = createShootSchema.safeParse({ ...valid, locationPostcode: "39" });
    expect(r.success).toBe(false);
  });

  it("rejects postcode 'abcd' (non-numeric)", () => {
    const r = createShootSchema.safeParse({ ...valid, locationPostcode: "abcd" });
    expect(r.success).toBe(false);
  });

  it("accepts payload with locationPostcode omitted", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { locationPostcode: _, ...rest } = valid;
    const r = createShootSchema.safeParse(rest);
    expect(r.success).toBe(true);
  });

  it("rejects shootDate in the past", () => {
    const r = createShootSchema.safeParse({ ...valid, shootDate: "2020-01-01" });
    expect(r.success).toBe(false);
  });

  it("rejects durationHours 0", () => {
    const r = createShootSchema.safeParse({ ...valid, durationHours: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects durationHours 25", () => {
    const r = createShootSchema.safeParse({ ...valid, durationHours: 25 });
    expect(r.success).toBe(false);
  });
});
