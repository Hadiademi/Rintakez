import { describe, expect, it, vi } from "vitest";
import { effectivePlan, getBidQuotaUsage, monthlyQuota, type SubRow } from "./entitlements";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("effectivePlan", () => {
  it("null row -> free, inactive", () => {
    expect(effectivePlan(null, NOW)).toEqual({
      plan: "free",
      isActive: false,
      source: null,
      expiresAt: null,
    });
  });

  it("comp source, comp_until in the future -> entitled to the comp plan", () => {
    const row: SubRow = {
      plan: "premium",
      status: "comp",
      source: "admin_comp",
      current_period_end: null,
      comp_until: "2026-07-01T00:00:00Z",
    };
    expect(effectivePlan(row, NOW)).toEqual({
      plan: "premium",
      isActive: true,
      source: "admin_comp",
      expiresAt: new Date("2026-07-01T00:00:00Z"),
    });
  });

  it("comp source, comp_until in the past -> expired, falls back to free", () => {
    const row: SubRow = {
      plan: "premium",
      status: "comp",
      source: "admin_comp",
      current_period_end: null,
      comp_until: "2026-06-01T00:00:00Z",
    };
    expect(effectivePlan(row, NOW)).toEqual({
      plan: "free",
      isActive: false,
      source: null,
      expiresAt: null,
    });
  });

  it("comp source, comp_until exactly equal to now -> expired (strict >)", () => {
    const row: SubRow = {
      plan: "standard",
      status: "comp",
      source: "admin_comp",
      current_period_end: null,
      comp_until: NOW.toISOString(),
    };
    expect(effectivePlan(row, NOW).isActive).toBe(false);
    expect(effectivePlan(row, NOW).plan).toBe("free");
  });

  it.each(["active", "trialing", "past_due"] as const)(
    "stripe source, status=%s and current_period_end in the future -> entitled",
    (status) => {
      const row: SubRow = {
        plan: "basic",
        status,
        source: "stripe",
        current_period_end: "2026-07-01T00:00:00Z",
        comp_until: null,
      };
      expect(effectivePlan(row, NOW)).toEqual({
        plan: "basic",
        isActive: true,
        source: "stripe",
        expiresAt: new Date("2026-07-01T00:00:00Z"),
      });
    }
  );

  it("stripe source, status=canceled -> NOT entitled even if current_period_end is future", () => {
    const row: SubRow = {
      plan: "basic",
      status: "canceled",
      source: "stripe",
      current_period_end: "2026-07-01T00:00:00Z",
      comp_until: null,
    };
    expect(effectivePlan(row, NOW)).toEqual({
      plan: "free",
      isActive: false,
      source: null,
      expiresAt: null,
    });
  });

  it("stripe source, current_period_end exactly equal to now -> expired (strict >)", () => {
    const row: SubRow = {
      plan: "standard",
      status: "active",
      source: "stripe",
      current_period_end: NOW.toISOString(),
      comp_until: null,
    };
    expect(effectivePlan(row, NOW).isActive).toBe(false);
  });

  it("stripe source, current_period_end in the past -> expired", () => {
    const row: SubRow = {
      plan: "standard",
      status: "active",
      source: "stripe",
      current_period_end: "2026-06-01T00:00:00Z",
      comp_until: null,
    };
    expect(effectivePlan(row, NOW).isActive).toBe(false);
  });

  it("comp source row with stale stripe fields ignores them entirely", () => {
    const row: SubRow = {
      plan: "premium",
      status: "comp",
      source: "admin_comp",
      // Stale/irrelevant leftover stripe fields must not leak into the comp check.
      current_period_end: "2099-01-01T00:00:00Z",
      comp_until: "2026-06-01T00:00:00Z", // already expired
    };
    expect(effectivePlan(row, NOW)).toEqual({
      plan: "free",
      isActive: false,
      source: null,
      expiresAt: null,
    });
  });
});

describe("monthlyQuota", () => {
  it("delegates to the MONTHLY_BID_QUOTA table", () => {
    expect(monthlyQuota("free")).toBe(1);
    expect(monthlyQuota("basic")).toBe(5);
    expect(monthlyQuota("standard")).toBe(32);
    expect(monthlyQuota("premium")).toBe(Infinity);
  });
});

function fakeSupabase({ subRow, bidCount }: { subRow: unknown; bidCount: number }) {
  return {
    from: vi.fn((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: subRow, error: null }),
        };
      }
      if (table === "bids") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ count: bidCount, error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  } as never;
}

describe("getBidQuotaUsage", () => {
  it("counts bids for a free-plan (no subscription row) photographer", async () => {
    const supabase = fakeSupabase({ subRow: null, bidCount: 1 });
    const result = await getBidQuotaUsage(supabase, "user-1", NOW);
    expect(result).toEqual({ plan: "free", used: 1, limit: 1 });
  });

  it("counts bids for an entitled standard-plan photographer", async () => {
    const subRow: SubRow = {
      plan: "standard",
      status: "active",
      source: "stripe",
      current_period_end: "2026-07-01T00:00:00Z",
      comp_until: null,
    };
    const supabase = fakeSupabase({ subRow, bidCount: 12 });
    const result = await getBidQuotaUsage(supabase, "user-2", NOW);
    expect(result).toEqual({ plan: "standard", used: 12, limit: 32 });
  });

  it("premium plan has an Infinity limit but still reports the used count", async () => {
    const subRow: SubRow = {
      plan: "premium",
      status: "comp",
      source: "admin_comp",
      current_period_end: null,
      comp_until: "2026-07-01T00:00:00Z",
    };
    const supabase = fakeSupabase({ subRow, bidCount: 500 });
    const result = await getBidQuotaUsage(supabase, "user-3", NOW);
    expect(result).toEqual({ plan: "premium", used: 500, limit: Infinity });
  });

  it("a null count from the DB is treated as 0 used", async () => {
    const supabase = fakeSupabase({ subRow: null, bidCount: null as unknown as number });
    const result = await getBidQuotaUsage(supabase, "user-4", NOW);
    expect(result.used).toBe(0);
  });
});
