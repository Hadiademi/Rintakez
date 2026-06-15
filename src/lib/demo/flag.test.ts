import { afterEach, describe, expect, it, vi } from "vitest";

describe("isDemo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false by default", async () => {
    vi.resetModules();
    const { isDemo } = await import("./flag");
    expect(isDemo()).toBe(false);
  });

  it("is true when NEXT_PUBLIC_DEMO_MODE=true", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { isDemo } = await import("./flag");
    expect(isDemo()).toBe(true);
  });
});
