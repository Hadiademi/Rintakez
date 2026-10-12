import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Review I18N-02: a Google signup never had its language stored, so every
// OAuth user got German emails (handle_new_user defaults locale to 'de'). The
// callback now saves the validated page locale for a brand-new account only;
// a returning user's saved choice is left alone.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

function fakeSupabase(createdAt: string) {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const supabase = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1", created_at: createdAt } } }),
    },
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn(() => ({ update })),
  };
  createClient.mockResolvedValue(supabase);
  return { supabase, update, eq };
}

const callback = (query: string) =>
  GET(new NextRequest(`https://framly.ch/auth/callback?code=abc&${query}`));

beforeEach(() => vi.clearAllMocks());

describe("OAuth callback locale", () => {
  it("stores the page language on a brand-new account", async () => {
    const db = fakeSupabase(new Date().toISOString());
    const res = await callback("locale=fr&role=photographer");

    expect(db.update).toHaveBeenCalledWith({ locale: "fr" });
    expect(db.eq).toHaveBeenCalledWith("id", "u-1");
    expect(res.headers.get("location")).toMatch(/^https:\/\/framly\.ch\/fr\/home\?signup=1$/);
  });

  it("leaves a returning user's saved language alone", async () => {
    const db = fakeSupabase("2026-01-01T00:00:00Z");
    await callback("locale=en");

    expect(db.update).not.toHaveBeenCalled();
  });

  it("never stores a locale we don't serve", async () => {
    const db = fakeSupabase(new Date().toISOString());
    await callback("locale=it");

    // safeLocale narrows unknown values to the default before anything is saved.
    expect(db.update).toHaveBeenCalledWith({ locale: "de" });
  });
});
