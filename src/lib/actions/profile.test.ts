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
  /** Conversations the user takes part in. */
  conversations?: Array<{ id: string }>;
  /** Storage listing per "bucket:prefix" (default: empty folder). */
  files?: Record<string, Array<{ id: string | null; name: string }>>;
}) {
  // Every side effect is logged in order, so tests can assert "Stripe is
  // settled before anything is deleted".
  const calls: string[] = [];
  const insert = vi.fn().mockImplementation(async () => {
    calls.push("audit_log.insert");
    return { error: null };
  });
  const deleteUser = vi.fn().mockImplementation(async () => {
    calls.push("auth.deleteUser");
    return opts.deleteUserResult ?? { error: null };
  });
  const removed: string[] = [];

  const from = vi.fn((table: string) => {
    if (table === "subscriptions") {
      return {
        select: vi.fn(() =>
          makeQueryBuilder(opts.subscriptionRow ?? { data: null, error: null })
        ),
      };
    }
    if (table === "conversations") {
      const builder = makeQueryBuilder({ data: opts.conversations ?? [], error: null });
      builder.or = vi.fn(() => builder);
      return { select: vi.fn(() => builder) };
    }
    if (table === "audit_log") return { insert };
    throw new Error(`unexpected table: ${table}`);
  });

  const storageFrom = vi.fn((bucket: string) => ({
    list: vi.fn(async (prefix: string) => {
      calls.push(`storage.list:${bucket}`);
      return { data: opts.files?.[`${bucket}:${prefix}`] ?? [], error: null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      calls.push(`storage.remove:${bucket}`);
      removed.push(...paths.map((p) => `${bucket}/${p}`));
      return { error: null };
    }),
  }));

  return {
    from,
    storage: { from: storageFrom },
    auth: { admin: { deleteUser } },
    insert,
    deleteUser,
    calls,
    removed,
  };
}

/** A Stripe fake whose subscription currently has `status`. */
function fakeStripe(status: string, calls?: string[]) {
  const retrieve = vi.fn(async () => {
    calls?.push("stripe.retrieve");
    return { status };
  });
  const cancel = vi.fn(async () => {
    calls?.push("stripe.cancel");
    return {};
  });
  return { subscriptions: { retrieve, cancel }, retrieve, cancel };
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
    const stripe = fakeStripe("active");
    const cancel = stripe.cancel;
    getStripe.mockReturnValue(stripe);

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
    const stripe = fakeStripe("active");
    stripe.cancel.mockRejectedValue(new Error("stripe down"));
    getStripe.mockReturnValue(stripe);

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

describe("deleteAccount — order, already-cancelled subscriptions, chat photos", () => {
  // Review PAY-03: storage was wiped BEFORE Stripe was asked to cancel, and
  // Stripe refuses to cancel a subscription that is already cancelled, so a
  // former subscriber lost their photos and still could not delete.
  it("settles Stripe before deleting any file", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: { stripe_subscription_id: "sub_1" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);
    getStripe.mockReturnValue(fakeStripe("active", admin.calls));

    await expect(deleteAccount()).resolves.toEqual({ ok: true });

    const firstStorage = admin.calls.findIndex((c) => c.startsWith("storage."));
    expect(admin.calls.indexOf("stripe.cancel")).toBeGreaterThan(-1);
    expect(admin.calls.indexOf("stripe.cancel")).toBeLessThan(firstStorage);
  });

  it("does not re-cancel an already cancelled subscription and still deletes", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: { stripe_subscription_id: "sub_old" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);
    const stripe = fakeStripe("canceled");
    getStripe.mockReturnValue(stripe);

    await expect(deleteAccount()).resolves.toEqual({ ok: true });
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(admin.deleteUser).toHaveBeenCalledWith(USER.id);
  });

  it("treats a subscription Stripe does not know as nothing to cancel", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: { stripe_subscription_id: "sub_test_mode" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);
    const stripe = fakeStripe("active");
    stripe.retrieve.mockRejectedValue(Object.assign(new Error("No such subscription"), { code: "resource_missing" }));
    getStripe.mockReturnValue(stripe);

    await expect(deleteAccount()).resolves.toEqual({ ok: true });
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(admin.deleteUser).toHaveBeenCalledWith(USER.id);
  });

  it("keeps every file when the cancellation fails", async () => {
    const admin = fakeAdmin({
      subscriptionRow: { data: { stripe_subscription_id: "sub_1" }, error: null },
      files: { "avatars:user-1": [{ id: "a1", name: "me.jpg" }] },
    });
    createAdminClient.mockReturnValue(admin);
    const stripe = fakeStripe("active", admin.calls);
    stripe.cancel.mockRejectedValue(new Error("stripe down"));
    getStripe.mockReturnValue(stripe);

    await expect(deleteAccount()).resolves.toEqual({ ok: false, error: "billing_cancel_failed" });
    expect(admin.calls.filter((c) => c.startsWith("storage.remove"))).toEqual([]);
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });

  // Review SEC-11: chat photos live under message-images/<conversationId>/,
  // so the uid-prefix sweep never found them. The conversations (and their
  // messages) cascade with the account; their photos must go too.
  it("removes the photos of the user's conversations", async () => {
    const admin = fakeAdmin({
      conversations: [{ id: "conv-1" }],
      files: {
        "message-images:conv-1": [
          { id: "f1", name: "a.jpg" },
          { id: "f2", name: "b.jpg" },
        ],
      },
    });
    createAdminClient.mockReturnValue(admin);

    await expect(deleteAccount()).resolves.toEqual({ ok: true });
    expect(admin.removed).toEqual(
      expect.arrayContaining(["message-images/conv-1/a.jpg", "message-images/conv-1/b.jpg"])
    );
    expect(admin.calls.indexOf("storage.remove:message-images")).toBeLessThan(
      admin.calls.indexOf("auth.deleteUser")
    );
  });
});

