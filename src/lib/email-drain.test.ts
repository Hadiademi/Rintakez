import { describe, expect, it, vi, beforeEach } from "vitest";

// The gift email (comp_granted) is rendered at send time from the live
// subscription row: an active gift is sent with its plan and end date; a gift
// revoked (or replaced by a paid plan) before the cron ran is skipped.
const { createAdminClient } = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test";
  return { createAdminClient: vi.fn() };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

import { drainEmailOutbox } from "@/lib/email";

type Result = { data: unknown; error: null };

function builder(result: Result, onUpdate?: (payload: unknown) => void) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "order", "limit", "single", "maybeSingle"]) b[m] = vi.fn(chain);
  b.update = vi.fn((payload: unknown) => {
    onUpdate?.(payload);
    return b;
  });
  b.then = ((ok: (v: Result) => unknown) => Promise.resolve(result).then(ok)) as PromiseLike<Result>["then"];
  return b;
}

function fakeAdmin(subscription: unknown) {
  const updates: unknown[] = [];
  const from = vi.fn((table: string) => {
    if (table === "email_outbox")
      return builder(
        {
          data: [{ id: 1, recipient_id: "u1", kind: "comp_granted", shoot_id: null, shoot_title: null, attempts: 0 }],
          error: null,
        },
        (p) => updates.push(p)
      );
    if (table === "profiles") return builder({ data: { display_name: "Marko", locale: "de" }, error: null });
    if (table === "subscriptions") return builder({ data: subscription, error: null });
    throw new Error(`unexpected table ${table}`);
  });
  return {
    from,
    updates,
    auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "m@example.ch" } } }) } },
  };
}

describe("drainEmailOutbox — gift email", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends an active gift with its plan and end date", async () => {
    const admin = fakeAdmin({ plan: "premium", source: "admin_comp", comp_until: "2099-01-07T12:00:00Z" });
    createAdminClient.mockReturnValue(admin);

    const res = await drainEmailOutbox();

    expect(res.sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("Ein Geschenk für dich: Framly Premium");
    expect(body.html).toContain("7. Januar 2099");
    expect(admin.updates).toContainEqual(expect.objectContaining({ status: "sent" }));
  });

  it("skips a gift that is no longer active, without sending", async () => {
    const admin = fakeAdmin({ plan: "premium", source: "stripe", comp_until: null });
    createAdminClient.mockReturnValue(admin);

    await drainEmailOutbox();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.updates).toContainEqual(
      expect.objectContaining({ status: "sent", last_error: "skipped: no active gift" })
    );
  });
});
