import { describe, expect, it, vi, beforeEach } from "vitest";

// submitReviewAction/replyToReview resolve getSessionUser()/rateLimit()/
// createClient() via module imports with no injection seam, so fake each
// module they pull from. Mirrors the vi.mock pattern in bids.test.ts.
const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));

import { submitReviewAction, replyToReview } from "./reviews";

const CLIENT_USER = { id: "client-1" };
const PHOTOGRAPHER_USER = { id: "photog-1" };

const VALID_REVIEW_INPUT = { rating: 5, comment: "Great work, thank you." };

type MaybeSingleResult = { data: unknown; error?: unknown };

/** Fake supabase client for submitReviewAction: shoots lookup, bids lookup,
 *  then reviews insert. Each table's query result is independently
 *  configurable per test. */
function fakeReviewSupabase(opts: {
  shootRow?: MaybeSingleResult;
  bidRow?: MaybeSingleResult;
  insertResult?: { error: unknown };
}) {
  const insert = vi
    .fn()
    .mockResolvedValue(opts.insertResult ?? { error: null });

  const from = vi.fn((table: string) => {
    if (table === "shoots") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue(opts.shootRow ?? { data: null }),
      };
    }
    if (table === "bids") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(opts.bidRow ?? { data: null }),
      };
    }
    if (table === "reviews") {
      return { insert };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { from, insert };
}

describe("submitReviewAction", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    rateLimit.mockReset();
    createClient.mockReset();
    revalidatePath.mockReset();

    getSessionUser.mockResolvedValue(CLIENT_USER);
    rateLimit.mockResolvedValue(true);
  });

  it("rejects an out-of-range rating as invalid_input before touching the DB", async () => {
    const result = await submitReviewAction("shoot-1", {
      rating: 6,
      comment: "x",
    });

    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getSessionUser.mockResolvedValue(null);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("is rate-limited", async () => {
    rateLimit.mockResolvedValue(false);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: false, error: "limit_reached" });
  });

  it("is forbidden when the shoot isn't the caller's", async () => {
    const supabase = fakeReviewSupabase({
      shootRow: {
        data: {
          client_id: "someone-else",
          status: "completed",
          accepted_bid_id: "bid-1",
        },
      },
    });
    createClient.mockResolvedValue(supabase);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("is forbidden when the shoot isn't completed yet", async () => {
    const supabase = fakeReviewSupabase({
      shootRow: {
        data: {
          client_id: CLIENT_USER.id,
          status: "assigned",
          accepted_bid_id: "bid-1",
        },
      },
    });
    createClient.mockResolvedValue(supabase);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("is forbidden when the shoot has no accepted bid", async () => {
    const supabase = fakeReviewSupabase({
      shootRow: {
        data: {
          client_id: CLIENT_USER.id,
          status: "completed",
          accepted_bid_id: null,
        },
      },
    });
    createClient.mockResolvedValue(supabase);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("returns not_found when the accepted bid row is missing", async () => {
    const supabase = fakeReviewSupabase({
      shootRow: {
        data: {
          client_id: CLIENT_USER.id,
          status: "completed",
          accepted_bid_id: "bid-1",
        },
      },
      bidRow: { data: null },
    });
    createClient.mockResolvedValue(supabase);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("maps a unique-violation insert error to already_reviewed", async () => {
    const supabase = fakeReviewSupabase({
      shootRow: {
        data: {
          client_id: CLIENT_USER.id,
          status: "completed",
          accepted_bid_id: "bid-1",
        },
      },
      bidRow: { data: { photographer_id: PHOTOGRAPHER_USER.id } },
      insertResult: { error: { code: "23505" } },
    });
    createClient.mockResolvedValue(supabase);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: false, error: "already_reviewed" });
  });

  it("maps any other insert error to a generic, logged error", async () => {
    const supabase = fakeReviewSupabase({
      shootRow: {
        data: {
          client_id: CLIENT_USER.id,
          status: "completed",
          accepted_bid_id: "bid-1",
        },
      },
      bidRow: { data: { photographer_id: PHOTOGRAPHER_USER.id } },
      insertResult: { error: { code: "42501", message: "denied" } },
    });
    createClient.mockResolvedValue(supabase);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("inserts with the accepted bid's photographer and revalidates on success", async () => {
    const supabase = fakeReviewSupabase({
      shootRow: {
        data: {
          client_id: CLIENT_USER.id,
          status: "completed",
          accepted_bid_id: "bid-1",
        },
      },
      bidRow: { data: { photographer_id: PHOTOGRAPHER_USER.id } },
    });
    createClient.mockResolvedValue(supabase);

    const result = await submitReviewAction("shoot-1", VALID_REVIEW_INPUT);

    expect(result).toEqual({ ok: true });
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        shoot_id: "shoot-1",
        client_id: CLIENT_USER.id,
        photographer_id: PHOTOGRAPHER_USER.id,
        rating: 5,
        comment: "Great work, thank you.",
      })
    );
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("stores a blank/whitespace-only comment as null", async () => {
    const supabase = fakeReviewSupabase({
      shootRow: {
        data: {
          client_id: CLIENT_USER.id,
          status: "completed",
          accepted_bid_id: "bid-1",
        },
      },
      bidRow: { data: { photographer_id: PHOTOGRAPHER_USER.id } },
    });
    createClient.mockResolvedValue(supabase);

    await submitReviewAction("shoot-1", { rating: 4, comment: "   " });

    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ comment: null })
    );
  });
});

/** Fake supabase client for replyToReview: update().eq().eq().is().select()
 *  — every step returns the chain except the terminal `.select()`, which
 *  resolves with the configured result. */
function fakeReplySupabase(updateResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.select = vi.fn().mockResolvedValue(updateResult);

  const update = vi.fn().mockReturnValue(chain);
  const from = vi.fn((table: string) => {
    if (table === "reviews") return { update };
    throw new Error(`unexpected table ${table}`);
  });
  return { from, update, chain };
}

describe("replyToReview", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    rateLimit.mockReset();
    createClient.mockReset();
    revalidatePath.mockReset();
    revalidateTag.mockReset();

    getSessionUser.mockResolvedValue(PHOTOGRAPHER_USER);
    rateLimit.mockResolvedValue(true);
  });

  it("rejects an empty reply as invalid_input before touching the DB", async () => {
    const result = await replyToReview("review-1", { text: "" });

    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getSessionUser.mockResolvedValue(null);

    const result = await replyToReview("review-1", { text: "Thanks!" });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("is rate-limited", async () => {
    rateLimit.mockResolvedValue(false);

    const result = await replyToReview("review-1", { text: "Thanks!" });

    expect(result).toEqual({ ok: false, error: "limit_reached" });
  });

  it("is forbidden when the update matches zero rows (not the owner, or already replied)", async () => {
    const supabase = fakeReplySupabase({ data: [], error: null });
    createClient.mockResolvedValue(supabase);

    const result = await replyToReview("review-1", { text: "Thanks!" });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("maps a DB error to a generic, logged error", async () => {
    const supabase = fakeReplySupabase({
      data: null,
      error: { code: "42501", message: "denied" },
    });
    createClient.mockResolvedValue(supabase);

    const result = await replyToReview("review-1", { text: "Thanks!" });

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("succeeds and revalidates the photographer's public profile", async () => {
    const supabase = fakeReplySupabase({ data: [{ id: "review-1" }], error: null });
    createClient.mockResolvedValue(supabase);

    const result = await replyToReview("review-1", { text: "Thanks!" });

    expect(result).toEqual({ ok: true });
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ reply: "Thanks!" })
    );
    expect(revalidateTag).toHaveBeenCalledWith(
      `photographer:${PHOTOGRAPHER_USER.id}`,
      "max"
    );
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});
