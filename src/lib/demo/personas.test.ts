import { describe, expect, it } from "vitest";
import { DEMO_PERSONAS, findPersona, personaById } from "./personas";

describe("demo personas", () => {
  it("has one photographer and one client", () => {
    expect(DEMO_PERSONAS.map((p) => p.role).sort()).toEqual([
      "client",
      "photographer",
    ]);
  });

  it("matches valid credentials (case-insensitive email)", () => {
    const p = findPersona("FOTOGRAF@demo.ch", "demo1234");
    expect(p?.role).toBe("photographer");
  });

  it("rejects a wrong password", () => {
    expect(findPersona("fotograf@demo.ch", "nope")).toBeNull();
  });

  it("resolves a persona by id", () => {
    expect(personaById(DEMO_PERSONAS[1].id)?.role).toBe("client");
  });
});
