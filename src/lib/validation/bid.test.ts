import { describe, expect, it } from "vitest";
import { createBidSchema } from "./bid";

const valid = {
  amountChf: 3800,
  message: "Ruhiger dokumentarischer Stil, ehrlich.",
};

describe("createBidSchema", () => {
  it("accepts a valid payload", () => {
    const r = createBidSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects amountChf 0", () => {
    const r = createBidSchema.safeParse({ ...valid, amountChf: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects amountChf -5", () => {
    const r = createBidSchema.safeParse({ ...valid, amountChf: -5 });
    expect(r.success).toBe(false);
  });

  it("accepts amountChf at the 1000000 ceiling", () => {
    const r = createBidSchema.safeParse({ ...valid, amountChf: 1000000 });
    expect(r.success).toBe(true);
  });

  it("rejects amountChf above 1000000", () => {
    const r = createBidSchema.safeParse({ ...valid, amountChf: 1000001 });
    expect(r.success).toBe(false);
  });

  it("rejects message shorter than 10 chars", () => {
    const r = createBidSchema.safeParse({ ...valid, message: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects message of 2001 chars", () => {
    const r = createBidSchema.safeParse({ ...valid, message: "a".repeat(2001) });
    expect(r.success).toBe(false);
  });
});
