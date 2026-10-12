import { beforeEach, describe, expect, it, vi } from "vitest";

// The DB now throttles reports itself (20261013120000, 10 per hour, the same
// limit as the action's rateLimit). When the in-memory limiter of one server
// instance has not seen the earlier reports, the DB refusal must still read as
// "limit reached" to the user, not as a generic failure.
const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

import { submitReport } from "./reports";

const INPUT = {
  targetType: "shoot",
  targetId: "6f9619ff-8b86-4d11-b42d-00c04fc964ff",
  reason: "Looks like spam to me.",
};

function fakeInsert(result: { error: unknown }) {
  const insert = vi.fn().mockResolvedValue(result);
  createClient.mockResolvedValue({ from: vi.fn(() => ({ insert })) });
  return insert;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "user-1" });
  rateLimit.mockResolvedValue(true);
});

describe("submitReport", () => {
  it("files the report", async () => {
    const insert = fakeInsert({ error: null });
    await expect(submitReport(INPUT)).resolves.toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: "user-1", category: "other" }));
  });

  it("reports the database throttle as limit_reached", async () => {
    fakeInsert({ error: { code: "P0001", message: "limit_reached" } });
    await expect(submitReport(INPUT)).resolves.toEqual({ ok: false, error: "limit_reached" });
  });

  it("still reports other database errors as generic", async () => {
    fakeInsert({ error: { code: "XX000", message: "boom" } });
    await expect(submitReport(INPUT)).resolves.toEqual({ ok: false, error: "generic" });
  });
});
