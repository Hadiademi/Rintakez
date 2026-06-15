import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

import { rpc } from "./rpc";
import { reseed } from "./store";
import { from } from "./query-builder";

const SHOOT_OPEN = "a0000000-0000-0000-0001-000000000001"; // Zermatt, 2 bids
const BID_MARKO = "a0000000-0000-0000-0002-000000000001";

describe("mock rpc", () => {
  beforeEach(() => {
    jar.clear();
    reseed();
  });

  it("accept_bid assigns the shoot, declines siblings, opens a conversation", async () => {
    const { error } = await rpc("accept_bid", { p_bid_id: BID_MARKO });
    expect(error).toBeNull();

    const { data: shoot } = await from("shoots").select("*").eq("id", SHOOT_OPEN).single();
    expect(shoot.status).toBe("assigned");
    expect(shoot.accepted_bid_id).toBe(BID_MARKO);

    const { data: siblings } = await from("bids")
      .select("*")
      .eq("shoot_id", SHOOT_OPEN)
      .neq("id", BID_MARKO);
    expect(siblings.every((b: any) => b.status === "declined")).toBe(true);

    const { data: convo } = await from("conversations")
      .select("*")
      .eq("shoot_id", SHOOT_OPEN)
      .maybeSingle();
    expect(convo).not.toBeNull();
  });

  it("decline_bid marks the bid declined", async () => {
    await rpc("decline_bid", { p_bid_id: BID_MARKO });
    const { data } = await from("bids").select("*").eq("id", BID_MARKO).single();
    expect(data.status).toBe("declined");
  });

  it("complete_shoot completes the shoot", async () => {
    await rpc("complete_shoot", { p_shoot_id: "a0000000-0000-0000-0001-000000000004" });
    const { data } = await from("shoots")
      .select("*")
      .eq("id", "a0000000-0000-0000-0001-000000000004")
      .single();
    expect(data.status).toBe("completed");
  });

  it("shoot_bid_count counts bids on a shoot", async () => {
    const { data } = await rpc("shoot_bid_count", { p_shoot_id: SHOOT_OPEN });
    expect(data).toBe(2);
  });

  it("get_counterparty_email returns the other party for a participant", async () => {
    // Client (Vitra) on the assigned shoot sees the photographer's email.
    jar.set("demo_user", "a0000000-0000-0000-0000-000000000002");
    const { data } = await rpc("get_counterparty_email", {
      p_shoot_id: "a0000000-0000-0000-0001-000000000004",
    });
    expect(data).toBe("fotograf@demo.ch");
  });

  it("set_initial_role updates the logged-in profile", async () => {
    jar.set("demo_user", "a0000000-0000-0000-0000-000000000001");
    await rpc("set_initial_role", { p_role: "photographer" });
    const { data } = await from("profiles")
      .select("*")
      .eq("id", "a0000000-0000-0000-0000-000000000001")
      .single();
    expect(data.role).toBe("photographer");
  });
});
