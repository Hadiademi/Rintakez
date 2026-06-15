import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory cookie jar standing in for next/headers cookies().
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

import { mockAuth } from "./auth";

describe("mock auth", () => {
  beforeEach(() => jar.clear());

  it("rejects unknown credentials", async () => {
    const { data, error } = await mockAuth.signInWithPassword({
      email: "nobody@demo.ch",
      password: "x",
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("signs in a persona and exposes it via getUser", async () => {
    const res = await mockAuth.signInWithPassword({
      email: "fotograf@demo.ch",
      password: "demo1234",
    });
    expect(res.error).toBeNull();
    const { data } = await mockAuth.getUser();
    expect(data.user?.id).toBe("a0000000-0000-0000-0000-000000000003");
    expect(data.user?.user_metadata.role).toBe("photographer");
  });

  it("clears the session on signOut", async () => {
    await mockAuth.signInWithPassword({ email: "klient@demo.ch", password: "demo1234" });
    await mockAuth.signOut();
    const { data } = await mockAuth.getUser();
    expect(data.user).toBeNull();
  });

  it("getSession reflects the logged-in persona", async () => {
    await mockAuth.signInWithPassword({ email: "klient@demo.ch", password: "demo1234" });
    const { data } = await mockAuth.getSession();
    expect(data.session?.user.id).toBe("a0000000-0000-0000-0000-000000000001");
  });
});
