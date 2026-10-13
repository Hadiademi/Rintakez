import { beforeEach, describe, expect, it, vi } from "vitest";

// cancelShootAction: since 20261013130000 the database refuses to cancel a
// booking on/after the shoot day or while a dispute is open. The client must
// see why ("booking_past" / "dispute_open"), not a generic failure.
const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
const { notifyEmail } = vi.hoisted(() => ({ notifyEmail: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getSessionUser, getProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/email", () => ({ notifyEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

import { acceptBidAction, cancelShootAction } from "./shoots";

function fakeUpdate(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const chain = { eq: vi.fn(() => chain), select };
  createClient.mockResolvedValue({ from: vi.fn(() => ({ update: vi.fn(() => chain) })) });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "client-1" });
});

describe("cancelShootAction", () => {
  it("says the shoot day has been reached", async () => {
    fakeUpdate({ data: null, error: { code: "P0001", message: "booking_past" } });
    await expect(cancelShootAction("shoot-1")).resolves.toEqual({ ok: false, error: "booking_past" });
    expect(notifyEmail).not.toHaveBeenCalled();
  });

  it("says a dispute is open", async () => {
    fakeUpdate({ data: null, error: { code: "P0001", message: "dispute_open" } });
    await expect(cancelShootAction("shoot-1")).resolves.toEqual({ ok: false, error: "dispute_open" });
  });

  it("keeps other database errors generic", async () => {
    fakeUpdate({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(cancelShootAction("shoot-1")).resolves.toEqual({ ok: false, error: "generic" });
  });
});

// After accepting, the client is offered "Message <photographer>" straight
// away; the conversation is opened by the assign trigger, so the action looks
// it up and hands its id back.
function fakeAccept(rows: Record<string, unknown>) {
  createClient.mockResolvedValue({
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn((table: string) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn().mockResolvedValue({ data: rows[table] ?? null }),
      };
      return chain;
    }),
  });
}

describe("acceptBidAction", () => {
  it("returns the conversation the booking opened", async () => {
    fakeAccept({
      bids: { photographer_id: "photog-1", shoot_id: "shoot-1" },
      shoots: { title: "Hochzeit" },
      conversations: { id: "conv-1" },
    });
    await expect(acceptBidAction("bid-1")).resolves.toEqual({ ok: true, conversationId: "conv-1" });
    expect(notifyEmail).toHaveBeenCalledWith(expect.objectContaining({ kind: "bid_accepted", shootId: "shoot-1" }));
  });

  it("still reports success when the conversation can't be found", async () => {
    fakeAccept({ bids: { photographer_id: "photog-1", shoot_id: "shoot-1" } });
    await expect(acceptBidAction("bid-1")).resolves.toEqual({ ok: true, conversationId: null });
  });
});
