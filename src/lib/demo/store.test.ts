import { describe, expect, it } from "vitest";
import { getStore, reseed } from "./store";

describe("demo store", () => {
  it("seeds photographers and shoots", () => {
    const s = getStore();
    expect(s.profiles.filter((p) => p.role === "photographer").length).toBeGreaterThanOrEqual(6);
    expect(s.shoots.length).toBeGreaterThanOrEqual(5);
  });

  it("reseed restores a mutated store", () => {
    getStore().shoots.push({ id: "temp-x" } as never);
    reseed();
    expect(getStore().shoots.find((sh) => sh.id === "temp-x")).toBeUndefined();
  });

  it("portfolio images carry full hosted URLs", () => {
    const s = getStore();
    expect(s.portfolio_images.length).toBeGreaterThan(0);
    expect(s.portfolio_images[0].storage_path).toMatch(/^https:\/\//);
  });
});
