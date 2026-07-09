import { describe, expect, it, vi, beforeEach } from "vitest";

// openDispute resolves getSessionUser()/rateLimit()/createClient() via module
// imports with no injection seam, so fake each module it pulls from. Mirrors
// the vi.mock pattern in bids.test.ts / reviews.test.ts.
const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { openDispute } from "./disputes";

const USER = { id: "user-1" };
const VALID_REASON = "The delivered photos do not match what was agreed.";

function fakeSupabase(insertResult: { error: unknown }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const from = vi.fn((table: string) => {
    if (table === "disputes") return { insert };
    throw new Error(`unexpected table ${table}`);
  });
  return { from, insert };
}

describe("openDispute", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    rateLimit.mockReset();
    createClient.mockReset();
    revalidatePath.mockReset();

    getSessionUser.mockResolvedValue(USER);
    rateLimit.mockResolvedValue(true);
  });

  it("rejects a too-short reason as invalid_input before touching the DB", async () => {
    const result = await openDispute("shoot-1", { reason: "too short" });

    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("rejects a missing reason as invalid_input", async () => {
    const result = await openDispute("shoot-1", {});

    expect(result).toEqual({ ok: false, error: "invalid_input" });
  });

  it("requires a session", async () => {
    getSessionUser.mockResolvedValue(null);

    const result = await openDispute("shoot-1", { reason: VALID_REASON });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("is rate-limited", async () => {
    rateLimit.mockResolvedValue(false);

    const result = await openDispute("shoot-1", { reason: VALID_REASON });

    expect(result).toEqual({ ok: false, error: "limit_reached" });
  });

  it("maps a DB insert error to a generic, logged error", async () => {
    const supabase = fakeSupabase({ error: { code: "42501", message: "denied" } });
    createClient.mockResolvedValue(supabase);

    const result = await openDispute("shoot-1", { reason: VALID_REASON });

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("inserts a trimmed reason for the caller and revalidates on success", async () => {
    const supabase = fakeSupabase({ error: null });
    createClient.mockResolvedValue(supabase);

    const result = await openDispute("shoot-1", {
      reason: `  ${VALID_REASON}  `,
    });

    expect(result).toEqual({ ok: true });
    expect(supabase.insert).toHaveBeenCalledWith({
      shoot_id: "shoot-1",
      opened_by: USER.id,
      reason: VALID_REASON,
    });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });
});
