import { describe, expect, it, vi } from "vitest";
import { submitBid } from "@/lib/core/bids";

function fakeSupabase(rpcResult: { error: { message: string } | null }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) } as never;
}

describe("submitBid", () => {
  it("calls the submit_bid RPC with mapped params and returns ok", async () => {
    const supabase = fakeSupabase({ error: null });
    const result = await submitBid(supabase, {
      shootId: "s1",
      amountChf: 700,
      message: "A long enough message.",
    });
    expect(result).toEqual({ ok: true });
  });

  it("maps an already_bid RPC error to the already_bid result", async () => {
    const supabase = fakeSupabase({ error: { message: "already_bid" } });
    const result = await submitBid(supabase, {
      shootId: "s1",
      amountChf: 700,
      message: "A long enough message.",
    });
    expect(result).toEqual({ ok: false, error: "already_bid" });
  });
});
