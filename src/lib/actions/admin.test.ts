import { describe, expect, it, vi, beforeEach } from "vitest";

// grantComp/revokeComp resolve their clients via getProfile()/createAdminClient()
// on every call (no injection seam), so we fake the modules they import from.
// The fake query builder is chainable (every method returns `this`) and
// thenable (awaiting it anywhere in the chain resolves to the configured
// result), mirroring how supabase-js query builders behave — same style as
// src/lib/email.test.ts.
const { getProfile } = vi.hoisted(() => ({ getProfile: vi.fn() }));
const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));
const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));

import { grantComp, revokeComp } from "./admin";

const ADMIN_PROFILE = { id: "admin-1", is_admin: true, role: "client" };
const PHOTOGRAPHER_ID = "photog-1";

type QueryResult = { data: unknown; error: unknown };

function makeQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "maybeSingle"]) {
    builder[method] = vi.fn(chain);
  }
  builder.then = ((onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled)) as PromiseLike<QueryResult>["then"];
  return builder as unknown as PromiseLike<QueryResult> & Record<string, unknown>;
}

/** Builds a fake admin client whose `.from(table)` is driven by per-table config. */
function fakeAdmin(opts: {
  profileRow?: QueryResult;
  subscriptionRow?: QueryResult;
  upsertResult?: { error: unknown };
  updateSubscriptionResult?: { error: unknown };
  updatePhotographerDetailsResult?: { error: unknown };
}) {
  const upsert = vi.fn().mockResolvedValue(opts.upsertResult ?? { error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });

  const subscriptionsUpdateEq = vi
    .fn()
    .mockResolvedValue(opts.updateSubscriptionResult ?? { error: null });
  const subscriptionsUpdate = vi.fn<
    (payload: Record<string, unknown>) => { eq: typeof subscriptionsUpdateEq }
  >(() => ({ eq: subscriptionsUpdateEq }));

  const photographerDetailsUpdateEq = vi
    .fn()
    .mockResolvedValue(opts.updatePhotographerDetailsResult ?? { error: null });
  const photographerDetailsUpdate = vi.fn<
    (payload: Record<string, unknown>) => { eq: typeof photographerDetailsUpdateEq }
  >(() => ({ eq: photographerDetailsUpdateEq }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() =>
          makeQueryBuilder(opts.profileRow ?? { data: null, error: null })
        ),
      };
    }
    if (table === "subscriptions") {
      return {
        select: vi.fn(() =>
          makeQueryBuilder(opts.subscriptionRow ?? { data: null, error: null })
        ),
        upsert,
        update: subscriptionsUpdate,
      };
    }
    if (table === "photographer_details") {
      return { update: photographerDetailsUpdate };
    }
    if (table === "audit_log") {
      return { insert };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    from,
    upsert,
    insert,
    subscriptionsUpdate,
    subscriptionsUpdateEq,
    photographerDetailsUpdate,
    photographerDetailsUpdateEq,
  };
}

describe("grantComp", () => {
  beforeEach(() => {
    getProfile.mockReset();
    createAdminClient.mockReset();
    revalidatePath.mockReset();
    revalidateTag.mockReset();
  });

  it("returns forbidden for a non-admin caller and touches no client", async () => {
    getProfile.mockResolvedValue(null);
    const admin = fakeAdmin({});
    createAdminClient.mockReturnValue(admin);

    const result = await grantComp(PHOTOGRAPHER_ID, "standard", 3);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rejects months=0 as invalid_input", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const admin = fakeAdmin({});
    createAdminClient.mockReturnValue(admin);

    const result = await grantComp(PHOTOGRAPHER_ID, "standard", 0);

    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rejects months=25 as invalid_input", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const admin = fakeAdmin({});
    createAdminClient.mockReturnValue(admin);

    const result = await grantComp(PHOTOGRAPHER_ID, "standard", 25);

    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("returns not_photographer when the target is a client", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const admin = fakeAdmin({
      profileRow: { data: { role: "client" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);

    const result = await grantComp(PHOTOGRAPHER_ID, "standard", 3);

    expect(result).toEqual({ ok: false, error: "not_photographer" });
    expect(admin.upsert).not.toHaveBeenCalled();
  });

  it("returns comp_conflicts_stripe when an active stripe sub is still in the future, and never upserts", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const admin = fakeAdmin({
      profileRow: { data: { role: "photographer" }, error: null },
      subscriptionRow: {
        data: {
          source: "stripe",
          status: "active",
          current_period_end: future,
          comp_until: null,
          stripe_customer_id: "cus_123",
        },
        error: null,
      },
    });
    createAdminClient.mockReturnValue(admin);

    const result = await grantComp(PHOTOGRAPHER_ID, "standard", 3);

    expect(result).toEqual({ ok: false, error: "comp_conflicts_stripe" });
    expect(admin.upsert).not.toHaveBeenCalled();
  });

  it("succeeds over a dead (canceled) stripe subscription", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const admin = fakeAdmin({
      profileRow: { data: { role: "photographer" }, error: null },
      subscriptionRow: {
        data: {
          source: "stripe",
          status: "canceled",
          current_period_end: "2020-01-01T00:00:00.000Z",
          comp_until: null,
          stripe_customer_id: "cus_123",
        },
        error: null,
      },
    });
    createAdminClient.mockReturnValue(admin);

    const result = await grantComp(PHOTOGRAPHER_ID, "standard", 3);

    expect(result).toEqual({ ok: true });
    expect(admin.upsert).toHaveBeenCalledTimes(1);
  });

  it("happy path: no existing sub, photographer target — upserts, syncs tier, audits", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const admin = fakeAdmin({
      profileRow: { data: { role: "photographer" }, error: null },
      subscriptionRow: { data: null, error: null },
    });
    createAdminClient.mockReturnValue(admin);

    const result = await grantComp(PHOTOGRAPHER_ID, "premium", 6, "  founding photographer  ");

    expect(result).toEqual({ ok: true });
    expect(admin.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = admin.upsert.mock.calls[0][0];
    expect(upsertArg).toMatchObject({
      user_id: PHOTOGRAPHER_ID,
      plan: "premium",
      status: "comp",
      source: "admin_comp",
      granted_by: ADMIN_PROFILE.id,
      note: "founding photographer",
    });
    expect(typeof upsertArg.comp_until).toBe("string");

    expect(admin.photographerDetailsUpdate).toHaveBeenCalledTimes(1);
    const detailsArg = admin.photographerDetailsUpdate.mock.calls[0][0];
    expect(detailsArg).toMatchObject({ plan_tier: "premium" });
    expect(admin.photographerDetailsUpdateEq).toHaveBeenCalledWith(
      "profile_id",
      PHOTOGRAPHER_ID
    );

    expect(admin.insert).toHaveBeenCalledTimes(1);
    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: ADMIN_PROFILE.id,
        action: "comp_granted",
        target_type: "profile",
        target_id: PHOTOGRAPHER_ID,
      })
    );

    expect(revalidateTag).toHaveBeenCalledWith("photographers-directory", "max");
    expect(revalidateTag).toHaveBeenCalledWith(`photographer:${PHOTOGRAPHER_ID}`, "max");
  });
});

describe("revokeComp", () => {
  beforeEach(() => {
    getProfile.mockReset();
    createAdminClient.mockReset();
    revalidatePath.mockReset();
    revalidateTag.mockReset();
  });

  it("returns forbidden for a non-admin caller", async () => {
    getProfile.mockResolvedValue(null);
    const admin = fakeAdmin({});
    createAdminClient.mockReturnValue(admin);

    const result = await revokeComp(PHOTOGRAPHER_ID);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("returns not_found when there is no subscription row", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const admin = fakeAdmin({ subscriptionRow: { data: null, error: null } });
    createAdminClient.mockReturnValue(admin);

    const result = await revokeComp(PHOTOGRAPHER_ID);

    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("returns not_comp and never updates the subscription when source is stripe", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const admin = fakeAdmin({
      subscriptionRow: { data: { source: "stripe" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);

    const result = await revokeComp(PHOTOGRAPHER_ID);

    expect(result).toEqual({ ok: false, error: "not_comp" });
    expect(admin.subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("happy path: source is admin_comp — sets comp_until to now, tier to free, audits", async () => {
    getProfile.mockResolvedValue(ADMIN_PROFILE);
    const admin = fakeAdmin({
      subscriptionRow: { data: { source: "admin_comp" }, error: null },
    });
    createAdminClient.mockReturnValue(admin);

    const result = await revokeComp(PHOTOGRAPHER_ID);

    expect(result).toEqual({ ok: true });
    expect(admin.subscriptionsUpdate).toHaveBeenCalledTimes(1);
    const updateArg = admin.subscriptionsUpdate.mock.calls[0][0];
    expect(typeof updateArg.comp_until).toBe("string");
    expect(admin.subscriptionsUpdateEq).toHaveBeenCalledWith("user_id", PHOTOGRAPHER_ID);

    expect(admin.photographerDetailsUpdate).toHaveBeenCalledWith({
      plan_tier: "free",
      plan_expires_at: null,
    });
    expect(admin.photographerDetailsUpdateEq).toHaveBeenCalledWith(
      "profile_id",
      PHOTOGRAPHER_ID
    );

    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: ADMIN_PROFILE.id,
        action: "comp_revoked",
        target_type: "profile",
        target_id: PHOTOGRAPHER_ID,
      })
    );

    expect(revalidateTag).toHaveBeenCalledWith("photographers-directory", "max");
  });
});
