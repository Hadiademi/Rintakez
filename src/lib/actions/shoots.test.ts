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

import { cancelShootAction } from "./shoots";

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
