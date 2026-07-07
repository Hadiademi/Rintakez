import { describe, expect, it, vi, beforeEach } from "vitest";

// deleteAccount resolves getSessionUser()/createAdminClient()/getStripe()/
// createClient() via module imports with no injection seam, so fake each
// module it pulls from — same vi.hoisted + vi.mock style as
// src/lib/actions/admin.test.ts / src/lib/email.test.ts. This file focuses on
// the P3 addition: cancelling a live Stripe subscription before the account
// (and its subscriptions row) is deleted, aborting the whole deletion if that
// cancellation fails so a paid subscription is never orphaned behind a
// deleted account.
const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
const { getStripe } = vi.hoisted(() => ({ getStripe: vi.fn() }));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/stripe", () => ({ getStripe }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/observability", () => ({ captureError }));

import { deleteAccount } from "./profile";

const USER = { id: "user-1" };

type QueryResult = { data: unknown; error: unknown };

function makeQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "maybeSingle"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = ((onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled)) as PromiseLike<QueryResult>["then"];
  return builder as unknown as PromiseLike<QueryResult> & Record<string, unknown>;
}

function fakeAdmin(opts: {
  subscriptionRow?: QueryResult;
  deleteUserResult?: { error: unknown };
}) {
  const list = vi.fn().mockResolvedValue({ data: [], error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const deleteUser = vi
    .fn()
    .mockResolvedValue(opts.deleteUserResult ?? { error: null });

  const from = vi.fn((table: string) => {
    if (table === "subscriptions") {
      return {
        select: vi.fn(() =>
          makeQueryBuilder(opts.subscriptionRow ?? { data: null, error: null })
        ),
      };
    }
    if (table === "audit_log") return { insert };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    from,
    storage: { from: vi.fn(() => ({ list, remove })) },
    auth: { admin: { deleteUser } },
    insert,
    deleteUser,
  };
}

beforeEach(() => {
  getSessionUser.mockReset();
  createAdminClient.mockReset();
  getStripe.mockReset();
  createClient.mockReset();
  captureError.mockReset();

  getSessionUser.mockResolvedValue(USER);
  createClient.mockResolvedValue({ auth: { signOut: vi.fn().mockResolvedValue({}) } });
});

describe("deleteAccount — Stripe cancel guard", () => {
  it("proceeds to delete when there is no subscription row", async () => {
    const admin = fakeAdmin({ subscriptionRow: { data: null, error: null } });
    createAdminClient.mockReturnValue(admin);

    const result = await deleteAccount();

    expect(result).toEqual({ ok: true });
    expect(getStripe).not.toHaveBeenCalled();
    expect(admin.deleteUser).toHaveBeenCalledWith(USER.id);
  });

  it("proceeds to delete when the subscription row has no stripe_subscription_id", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: { stripe_subscription_id: null }, error: null },
    });
    createAdminClient.mockReturnValue(admin);

    const result = await deleteAccount();

    expect(result).toEqual({ ok: true });
    expect(getStripe).not.toHaveBeenCalled();
    expect(admin.deleteUser).toHaveBeenCalledWith(USER.id);
  });

  it("proceeds to delete when Stripe is not configured, even with a live stripe_subscription_id", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: { stripe_subscription_id: "sub_1" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);
    getStripe.mockReturnValue(null);

    const result = await deleteAccount();

    expect(result).toEqual({ ok: true });
    expect(admin.deleteUser).toHaveBeenCalledWith(USER.id);
  });

  it("cancels the Stripe subscription then proceeds to delete on success", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: { stripe_subscription_id: "sub_1" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);
    const cancel = vi.fn().mockResolvedValue({});
    getStripe.mockReturnValue({ subscriptions: { cancel } });

    const result = await deleteAccount();

    expect(cancel).toHaveBeenCalledWith("sub_1");
    expect(result).toEqual({ ok: true });
    expect(admin.deleteUser).toHaveBeenCalledWith(USER.id);
  });

  it("aborts the whole deletion with billing_cancel_failed when Stripe cancellation throws", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: { stripe_subscription_id: "sub_1" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);
    const cancel = vi.fn().mockRejectedValue(new Error("stripe down"));
    getStripe.mockReturnValue({ subscriptions: { cancel } });

    const result = await deleteAccount();

    expect(result).toEqual({ ok: false, error: "billing_cancel_failed" });
    expect(admin.deleteUser).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  // FIX 3 — a transient subscriptions READ error must abort deletion (fail
  // safe), never proceed and orphan a possibly-live paid Stripe subscription.
  it("aborts with billing_cancel_failed when the subscriptions read errors (never orphans a live sub)", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: null, error: { code: "XX000", message: "read failed" } },
    });
    createAdminClient.mockReturnValue(admin);

    const result = await deleteAccount();

    expect(result).toEqual({ ok: false, error: "billing_cancel_failed" });
    expect(admin.deleteUser).not.toHaveBeenCalled();
    expect(getStripe).not.toHaveBeenCalled();
  });
});
