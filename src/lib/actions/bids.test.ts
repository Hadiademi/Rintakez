import { describe, expect, it, vi, beforeEach } from "vitest";

// submitBidAction resolves getProfile()/rateLimit()/createClient() via module
// imports with no injection seam, so fake each module it pulls from. Mirrors
// the vi.mock pattern in src/lib/email.test.ts.
const { getProfile } = vi.hoisted(() => ({ getProfile: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));
const { getBidQuotaUsage } = vi.hoisted(() => ({ getBidQuotaUsage: vi.fn() }));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
const { notifyEmail } = vi.hoisted(() => ({ notifyEmail: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getProfile, getSessionUser: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/billing/entitlements", () => ({ getBidQuotaUsage }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/email", () => ({ notifyEmail }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { submitBidAction } from "./bids";

const PHOTOGRAPHER_PROFILE = { id: "photog-1", role: "photographer" };

function fakeSupabase(insertResult: { error: unknown }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const from = vi.fn((table: string) => {
    if (table === "bids") {
      return { insert };
    }
    // shoots lookup for the post-insert notify email — no row, so notifyEmail
    // is skipped without needing to model its shape here.
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
  });
  return { from, insert };
}

const VALID_INPUT = { amountChf: 500, message: "A message long enough." };

describe("submitBidAction quota gate", () => {
  beforeEach(() => {
    getProfile.mockReset();
    rateLimit.mockReset();
    getBidQuotaUsage.mockReset();
    createClient.mockReset();
    notifyEmail.mockReset();
    revalidatePath.mockReset();

    getProfile.mockResolvedValue(PHOTOGRAPHER_PROFILE);
    rateLimit.mockResolvedValue(true);
  });

  it("blocks and does not insert when the quota is reached", async () => {
    getBidQuotaUsage.mockResolvedValue({ plan: "free", used: 1, limit: 1 });
    const supabase = fakeSupabase({ error: null });
    createClient.mockResolvedValue(supabase);

    const result = await submitBidAction("shoot-1", VALID_INPUT);

    expect(result).toEqual({ ok: false, error: "quota_reached" });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("proceeds and inserts when under quota", async () => {
    getBidQuotaUsage.mockResolvedValue({ plan: "free", used: 0, limit: 1 });
    const supabase = fakeSupabase({ error: null });
    createClient.mockResolvedValue(supabase);

    const result = await submitBidAction("shoot-1", VALID_INPUT);

    expect(supabase.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("never blocks premium (Infinity limit)", async () => {
    getBidQuotaUsage.mockResolvedValue({
      plan: "premium",
      used: 99,
      limit: Infinity,
    });
    const supabase = fakeSupabase({ error: null });
    createClient.mockResolvedValue(supabase);

    const result = await submitBidAction("shoot-1", VALID_INPUT);

    expect(supabase.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("rejects non-photographers as forbidden before the quota check", async () => {
    getProfile.mockResolvedValue({ id: "client-1", role: "client" });

    const result = await submitBidAction("shoot-1", VALID_INPUT);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(getBidQuotaUsage).not.toHaveBeenCalled();
  });
});
