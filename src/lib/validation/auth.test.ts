import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema } from "./auth";

describe("registerSchema", () => {
  it("accepts a valid client registration", () => {
    const r = registerSchema.safeParse({
      email: "a@b.ch", password: "password123", displayName: "Lena K.", role: "client", locale: "de",
    });
    expect(r.success).toBe(true);
  });
  it("rejects a short password", () => {
    const r = registerSchema.safeParse({
      email: "a@b.ch", password: "short", displayName: "Lena K.", role: "client", locale: "de",
    });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid role", () => {
    const r = registerSchema.safeParse({
      email: "a@b.ch", password: "password123", displayName: "Lena K.", role: "admin", locale: "de",
    });
    expect(r.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.ch", password: "password123" }).success).toBe(true);
  });
});
