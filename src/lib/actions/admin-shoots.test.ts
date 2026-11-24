import { describe, expect, it, vi, beforeEach } from "vitest";

// Admin shoot moderation: hiding (setShootSuspension) and permanent removal
// (deleteShoot). Both resolve their clients via getProfile()/createAdminClient()
// on every call, so — as in admin.test.ts — we fake the modules they import.
const { getProfile } = vi.hoisted(() => ({ getProfile: vi.fn() }));
const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getProfile }));
vi.mock("@/lib/email", () => ({ notifyEmail: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));
vi.mock("@/lib/observability", () => ({ captureError }));

import { deleteShoot, setShootSuspension } from "./admin";

const ADMIN = { id: "admin-1", is_admin: true, role: "client" };
const SHOOT_ID = "8297718e-178f-48ed-8384-d5d3f9d11f31";
const OPEN_SHOOT = {
  id: SHOOT_ID,
  title: "Hochzeit",
  client_id: "client-1",
  status: "open",
  accepted_bid_id: null,
};

type Result = { data?: unknown; error?: unknown; count?: number | null };

/**
 * A chainable, thenable stand-in for a supabase-js query builder. Every call
 * is recorded as [method, ...args] so tests can assert on filters.
 */
function builder(result: Result) {
  const calls: unknown[][] = [];
  const b: Record<string, unknown> = { calls };
  for (const m of ["select", "eq", "maybeSingle", "update", "delete", "insert"]) {
    b[m] = vi.fn((...args: unknown[]) => {
      calls.push([m, ...args]);
      return b;
    });
  }
  b.then = (resolve: (v: Result) => unknown) =>
    Promise.resolve({ data: null, error: null, count: null, ...result }).then(resolve);
  return b as Record<string, ReturnType<typeof vi.fn>> & { calls: unknown[][] };
}

function fakeAdmin(opts: {
  shoot?: Result;
  disputes?: Result;
  images?: Result;
  shootDelete?: Result;
  storageError?: unknown;
}) {
  const tables: Record<string, ReturnType<typeof builder>[]> = {};
  const remove = vi.fn().mockResolvedValue({ error: opts.storageError ?? null });
  let shootCalls = 0;
  const from = vi.fn((table: string) => {
    let b: ReturnType<typeof builder>;
    if (table === "shoots") {
      // 1st: the read; 2nd: the delete (or the suspension update).
      b = builder(shootCalls++ === 0 ? (opts.shoot ?? { data: OPEN_SHOOT }) : (opts.shootDelete ?? {}));
    } else if (table === "disputes") {
      b = builder(opts.disputes ?? { count: 0 });
    } else if (table === "shoot_images") {
      b = builder(opts.images ?? { data: [] });
    } else {
      b = builder({});
    }
    (tables[table] ??= []).push(b);
    return b;
  });
  const client = { from, storage: { from: vi.fn(() => ({ remove })) } };
  return { client, tables, remove };
}

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(ADMIN);
});

describe("setShootSuspension", () => {
  it("drops the landing page's cached open shoots right away", async () => {
    const { client } = fakeAdmin({ shoot: {} });
    createAdminClient.mockReturnValue(client);

    const r = await setShootSuspension(SHOOT_ID, true, "Unpassendes Bild");

    expect(r).toEqual({ ok: true });
    expect(revalidateTag).toHaveBeenCalledWith("shoots:open", { expire: 0 });
  });

  it("refuses non-admins", async () => {
    getProfile.mockResolvedValue({ id: "u1", is_admin: false });
    expect(await setShootSuspension(SHOOT_ID, true)).toEqual({ ok: false, error: "forbidden" });
  });
});

describe("deleteShoot", () => {
  it("refuses non-admins without touching the database", async () => {
    getProfile.mockResolvedValue({ id: "u1", is_admin: false });
    const { client } = fakeAdmin({});
    createAdminClient.mockReturnValue(client);

    expect(await deleteShoot(SHOOT_ID)).toEqual({ ok: false, error: "forbidden" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a uuid", async () => {
    createAdminClient.mockReturnValue(fakeAdmin({}).client);
    expect(await deleteShoot("not-a-uuid")).toEqual({ ok: false, error: "invalid_input" });
  });

  it("reports a missing shoot", async () => {
    createAdminClient.mockReturnValue(fakeAdmin({ shoot: { data: null } }).client);
    expect(await deleteShoot(SHOOT_ID)).toEqual({ ok: false, error: "not_found" });
  });

  it("keeps a booked shoot: it can only be hidden", async () => {
    const { client, tables } = fakeAdmin({
      shoot: { data: { ...OPEN_SHOOT, status: "assigned", accepted_bid_id: "bid-1" } },
    });
    createAdminClient.mockReturnValue(client);

    expect(await deleteShoot(SHOOT_ID)).toEqual({ ok: false, error: "shoot_not_deletable" });
    expect(tables.shoots).toHaveLength(1); // the read only, no delete
  });

  it("keeps a shoot with a dispute", async () => {
    const { client, tables } = fakeAdmin({ disputes: { count: 1 } });
    createAdminClient.mockReturnValue(client);

    expect(await deleteShoot(SHOOT_ID)).toEqual({ ok: false, error: "shoot_not_deletable" });
    expect(tables.shoots).toHaveLength(1);
  });

  it("deletes the shoot, its images and queued emails, and logs it", async () => {
    const paths = ["client-1/" + SHOOT_ID + "/a.jpg", "client-1/" + SHOOT_ID + "/b.jpg"];
    const { client, tables, remove } = fakeAdmin({
      images: { data: paths.map((storage_path) => ({ storage_path })) },
    });
    createAdminClient.mockReturnValue(client);

    expect(await deleteShoot(SHOOT_ID)).toEqual({ ok: true });

    const del = tables.shoots[1];
    expect(del.calls).toContainEqual(["delete"]);
    expect(del.calls).toContainEqual(["eq", "id", SHOOT_ID]);

    expect(client.storage.from).toHaveBeenCalledWith("shoot-refs");
    expect(remove).toHaveBeenCalledWith(paths);

    const outbox = tables.email_outbox[0];
    expect(outbox.calls).toContainEqual(["delete"]);
    expect(outbox.calls).toContainEqual(["eq", "shoot_id", SHOOT_ID]);
    expect(outbox.calls).toContainEqual(["eq", "status", "pending"]);

    const audit = tables.audit_log[0];
    expect(audit.calls[0]).toEqual([
      "insert",
      {
        actor_id: ADMIN.id,
        action: "shoot_deleted",
        target_type: "shoot",
        target_id: SHOOT_ID,
        meta: { title: "Hochzeit", client_id: "client-1", images: 2 },
      },
    ]);
    expect(revalidateTag).toHaveBeenCalledWith("shoots:open", { expire: 0 });
  });

  it("does not touch storage or the log when the delete fails", async () => {
    const { client, tables, remove } = fakeAdmin({
      images: { data: [{ storage_path: "x/y/z.jpg" }] },
      shootDelete: { error: { message: "boom" } },
    });
    createAdminClient.mockReturnValue(client);

    expect(await deleteShoot(SHOOT_ID)).toEqual({ ok: false, error: "generic" });
    expect(remove).not.toHaveBeenCalled();
    expect(tables.audit_log).toBeUndefined();
  });

  it("still succeeds when removing the image files fails, and reports it", async () => {
    const { client } = fakeAdmin({
      images: { data: [{ storage_path: "x/y/z.jpg" }] },
      storageError: { message: "storage down" },
    });
    createAdminClient.mockReturnValue(client);

    expect(await deleteShoot(SHOOT_ID)).toEqual({ ok: true });
    expect(captureError).toHaveBeenCalled();
  });
});
