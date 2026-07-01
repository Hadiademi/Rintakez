import { describe, expect, it, vi, beforeEach } from "vitest";

// notifyEmail resolves its admin client via createAdminClient() on every call
// (no injection seam), so we fake the module it imports from. The fake query
// builder is chainable (every method returns `this`) and thenable (awaiting
// it anywhere in the chain resolves to the configured result), which mirrors
// how supabase-js query builders behave.
const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { notifyEmail } from "@/lib/email";

type QueryResult = { data: unknown; error: null };

function makeQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "gte", "is", "limit", "maybeSingle"]) {
    builder[method] = vi.fn(chain);
  }
  builder.then = ((onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled)) as PromiseLike<QueryResult>["then"];
  return builder as unknown as PromiseLike<QueryResult>;
}

function fakeAdmin(opts: { existingRow: unknown }) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const outboxSelectResult: QueryResult = {
    data: opts.existingRow,
    error: null,
  };
  const from = vi.fn((table: string) => {
    if (table === "email_outbox") {
      return {
        select: vi.fn(() => makeQueryBuilder(outboxSelectResult)),
        insert,
      };
    }
    // profiles: no pref column configured on message_received's gate is
    // "notify_messages", so return enabled (not explicitly false).
    return makeQueryBuilder({ data: { notify_messages: true }, error: null });
  });
  return { from, insert };
}

describe("notifyEmail dedupe", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
  });

  it("skips the insert when a recent matching row already exists", async () => {
    const admin = fakeAdmin({ existingRow: { id: 1 } });
    createAdminClient.mockReturnValue(admin);

    await notifyEmail({
      kind: "message_received",
      recipientId: "user-1",
      shootId: "shoot-1",
      dedupeWindowMs: 900_000,
    });

    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("inserts when no recent matching row exists", async () => {
    const admin = fakeAdmin({ existingRow: null });
    createAdminClient.mockReturnValue(admin);

    await notifyEmail({
      kind: "message_received",
      recipientId: "user-1",
      shootId: "shoot-1",
      dedupeWindowMs: 900_000,
    });

    expect(admin.insert).toHaveBeenCalledTimes(1);
    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_id: "user-1", kind: "message_received" })
    );
  });

  it("does not run the dedupe check when dedupeWindowMs is omitted", async () => {
    const admin = fakeAdmin({ existingRow: { id: 1 } });
    createAdminClient.mockReturnValue(admin);

    await notifyEmail({
      kind: "message_received",
      recipientId: "user-1",
      shootId: "shoot-1",
    });

    // No dedupeWindowMs => existing behaviour => always insert.
    expect(admin.insert).toHaveBeenCalledTimes(1);
  });
});
