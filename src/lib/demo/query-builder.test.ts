import { beforeEach, describe, expect, it } from "vitest";
import { reseed } from "./store";
import { from } from "./query-builder";

describe("MockQuery", () => {
  beforeEach(() => reseed());

  it("filters by eq", async () => {
    const { data } = await from("shoots").select("*").eq("status", "open");
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((s: any) => s.status === "open")).toBe(true);
  });

  it("orders descending and limits", async () => {
    const { data } = await from("shoots")
      .select("*")
      .order("shoot_date", { ascending: false })
      .limit(2);
    expect(data.length).toBe(2);
    expect(data[0].shoot_date >= data[1].shoot_date).toBe(true);
  });

  it("supports in()", async () => {
    const { data } = await from("shoots")
      .select("*")
      .in("status", ["assigned", "completed"]);
    expect(data.every((s: any) => ["assigned", "completed"].includes(s.status))).toBe(true);
  });

  it("maybeSingle returns null for no match", async () => {
    const { data } = await from("profiles").select("*").eq("id", "nope").maybeSingle();
    expect(data).toBeNull();
  });

  it("single returns an error for no match", async () => {
    const { data, error } = await from("profiles").select("*").eq("id", "nope").single();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("count/head returns a number and no rows", async () => {
    const { data, count } = await from("shoots").select("id", {
      count: "exact",
      head: true,
    });
    expect(data).toBeNull();
    expect(typeof count).toBe("number");
  });

  it("inserts a row with generated id and returns it via select().single()", async () => {
    const { data } = await from("shoots")
      .insert({
        client_id: "a0000000-0000-0000-0000-000000000001",
        title: "New demo shoot",
        type: "portrait",
        brief: "x",
        location_city: "Zürich",
        canton: "ZH",
        shoot_date: "2026-10-10",
        duration_hours: 2,
        budget_min_chf: 500,
        budget_max_chf: 900,
      })
      .select("id")
      .single();
    expect(data.id).toBeTruthy();
    expect(data.status).toBe("open"); // default applied
    const { data: all } = await from("shoots").select("*").eq("title", "New demo shoot");
    expect(all.length).toBe(1);
  });

  it("updates matched rows", async () => {
    await from("bids")
      .update({ status: "withdrawn" })
      .eq("id", "a0000000-0000-0000-0002-000000000001");
    const { data } = await from("bids")
      .select("*")
      .eq("id", "a0000000-0000-0000-0002-000000000001")
      .single();
    expect(data.status).toBe("withdrawn");
  });

  it("deletes matched rows", async () => {
    await from("favorites")
      .delete()
      .eq("user_id", "a0000000-0000-0000-0000-000000000001")
      .eq("photographer_id", "a0000000-0000-0000-0000-000000000003");
    const { data } = await from("favorites")
      .select("*")
      .eq("photographer_id", "a0000000-0000-0000-0000-000000000003");
    expect(data.length).toBe(0);
  });

  it("upserts by onConflict key", async () => {
    await from("photographer_details").upsert(
      { profile_id: "a0000000-0000-0000-0000-000000000003", hourly_rate_chf: 999 },
      { onConflict: "profile_id" }
    );
    const { data } = await from("photographer_details")
      .select("*")
      .eq("profile_id", "a0000000-0000-0000-0000-000000000003")
      .single();
    expect(data.hourly_rate_chf).toBe(999);
  });
});

describe("MockQuery embedded relations", () => {
  beforeEach(() => reseed());

  it("resolves an aliased FK-hint embedded select (to-one)", async () => {
    const { data } = await from("bids")
      .select(
        "id,amount_chf,message,status,photographer:profiles!bids_photographer_id_fkey(id,display_name,city,canton)"
      )
      .eq("id", "a0000000-0000-0000-0002-000000000001")
      .single();
    expect(data.photographer).not.toBeNull();
    expect(data.photographer.display_name).toBe("Marko Brunner");
  });

  it("resolves multiple embeds and keeps plain columns", async () => {
    const { data } = await from("bids")
      .select(
        "id,amount_chf,shoot:shoots!bids_shoot_id_fkey(id,title),photographer:profiles!bids_photographer_id_fkey(display_name)"
      )
      .eq("id", "a0000000-0000-0000-0002-000000000002");
    expect(data[0].amount_chf).toBe(5600);
    expect(data[0].shoot.title).toBe("Editorial — Vitra Sommerkollektion");
    expect(data[0].photographer.display_name).toBe("Claire Dubois");
  });
});
