import { describe, expect, it, vi } from "vitest";
import { invitePhotographer } from "@/lib/core/invites";

function fakeSupabase(insertResult: { error: { code?: string; message: string } | null }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue(insertResult),
    }),
  } as never;
}

describe("invitePhotographer", () => {
  it("inserts the invitation and returns ok", async () => {
    const supabase = fakeSupabase({ error: null });
    const result = await invitePhotographer(supabase, {
      photographerId: "p1",
      shootId: "s1",
      clientId: "c1",
    });
    expect(result).toEqual({ ok: true });
  });

  it("maps a unique violation to already_invited", async () => {
    const supabase = fakeSupabase({ error: { code: "23505", message: "duplicate key" } });
    const result = await invitePhotographer(supabase, {
      photographerId: "p1",
      shootId: "s1",
      clientId: "c1",
    });
    expect(result).toEqual({ ok: false, error: "already_invited" });
  });
});
