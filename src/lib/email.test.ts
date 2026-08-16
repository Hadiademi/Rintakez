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

describe("render (branded template)", () => {
  it("renders every kind in every locale with the brand invariants intact", async () => {
    const { render, COPY } = await import("@/lib/email");
    const kinds = Object.keys(COPY) as (keyof typeof COPY)[];
    for (const kind of kinds) {
      for (const locale of ["de", "fr", "en"] as const) {
        const { subject, html, text } = render(
          kind,
          locale,
          "Marko",
          kind === "welcome" ? null : "Hochzeit in Chur",
          "https://framly.ch/x"
        );
        expect(subject).toBe(COPY[kind][locale].subject);
        // Wordmark with the terracotta period, as text (never an image).
        expect(html).toContain('Framly<span style="color:#C8462C">.</span>');
        expect(html).not.toContain("<img");
        // Preheader, CTA link, legal footer.
        expect(html).toContain("mso-hide:all");
        expect(html).toContain('href="https://framly.ch/x"');
        expect(html).toContain("/impressum");
        expect(html).toContain(COPY[kind][locale].cta);
        // Plain-text alternative carries the CTA URL too.
        expect(text).toContain("https://framly.ch/x");
      }
    }
  });
});
