import { beforeEach, describe, expect, it, vi } from "vitest";

// Review I18N-02 / FLOW-11: profiles.locale (the language of every email and of
// the Stripe return URLs) was written once at email signup and never again.
// Switching the site language must now persist it for a signed-in user.
const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

import { setPreferredLocale } from "./settings";

function fakeSupabase(result: { error: unknown } = { error: null }) {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  createClient.mockResolvedValue({ from });
  return { from, update, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setPreferredLocale", () => {
  it("saves the chosen language on the signed-in user's own profile", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    const db = fakeSupabase();

    await expect(setPreferredLocale("fr")).resolves.toEqual({ ok: true, saved: true });
    expect(db.from).toHaveBeenCalledWith("profiles");
    expect(db.update).toHaveBeenCalledWith({ locale: "fr" });
    expect(db.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("is a no-op for visitors who are not signed in", async () => {
    getSessionUser.mockResolvedValue(null);
    const db = fakeSupabase();

    await expect(setPreferredLocale("en")).resolves.toEqual({ ok: true, saved: false });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("rejects anything that is not a language we serve", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    const db = fakeSupabase();

    for (const bad of ["it", "", "de-CH", "../x", 42]) {
      await expect(setPreferredLocale(bad as string)).resolves.toEqual({ ok: false, error: "invalid_input" });
    }
    expect(db.from).not.toHaveBeenCalled();
  });

  it("reports a database failure", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    fakeSupabase({ error: { code: "XX000", message: "boom" } });

    await expect(setPreferredLocale("de")).resolves.toEqual({ ok: false, error: "generic" });
  });
});
