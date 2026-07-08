import { describe, expect, it } from "vitest";
import { buildMonthMatrix } from "./month-grid";

// `month` is 0-indexed to match JS Date (0 = January … 11 = December).

describe("buildMonthMatrix", () => {
  it("aligns weeks to a Monday start for a mid-week month (April 2026)", () => {
    // April 1, 2026 is a Wednesday, so the first row leads with Mar 30 (Mon).
    const weeks = buildMonthMatrix(2026, 3, new Set(), "2026-04-15");
    expect(weeks[0][0].dateISO).toBe("2026-03-30"); // Monday
    expect(weeks[0][1].dateISO).toBe("2026-03-31"); // Tuesday
    expect(weeks[0][2].dateISO).toBe("2026-04-01"); // Wednesday, first in-month day
    // Every row has exactly 7 cells.
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it("marks leading and trailing days as out-of-month", () => {
    const weeks = buildMonthMatrix(2026, 3, new Set(), "2026-04-15");
    expect(weeks[0][0].inMonth).toBe(false); // Mar 30
    expect(weeks[0][2].inMonth).toBe(true); // Apr 1
    const last = weeks[weeks.length - 1];
    // April has 30 days; trailing cells spill into May.
    const trailing = last.filter((c) => !c.inMonth);
    for (const cell of trailing) expect(cell.dateISO.startsWith("2026-05")).toBe(true);
  });

  it("handles a month that starts on a Sunday (February 2026)", () => {
    // Feb 1, 2026 is a Sunday: the first row runs Jan 26 (Mon) … Feb 1 (Sun).
    const weeks = buildMonthMatrix(2026, 1, new Set(), "2026-02-15");
    expect(weeks[0][0].dateISO).toBe("2026-01-26"); // Monday
    expect(weeks[0][6].dateISO).toBe("2026-02-01"); // Sunday, first in-month day
    expect(weeks[0][6].inMonth).toBe(true);
    expect(weeks[0][0].inMonth).toBe(false);
  });

  it("includes Feb 29 in a leap year (February 2024)", () => {
    const weeks = buildMonthMatrix(2024, 1, new Set(), "2024-02-15");
    const inMonthDates = weeks.flat().filter((c) => c.inMonth).map((c) => c.dateISO);
    expect(inMonthDates).toContain("2024-02-29");
    expect(inMonthDates).not.toContain("2024-02-30");
    expect(inMonthDates[inMonthDates.length - 1]).toBe("2024-02-29");
  });

  it("stops at Feb 28 in a non-leap year (February 2026)", () => {
    const weeks = buildMonthMatrix(2026, 1, new Set(), "2026-02-15");
    const inMonthDates = weeks.flat().filter((c) => c.inMonth).map((c) => c.dateISO);
    expect(inMonthDates).not.toContain("2026-02-29");
    expect(inMonthDates[inMonthDates.length - 1]).toBe("2026-02-28");
  });

  it("marks unavailable days from the set", () => {
    const weeks = buildMonthMatrix(2026, 3, new Set(["2026-04-10"]), "2026-04-15");
    const cells = weeks.flat();
    const target = cells.find((c) => c.dateISO === "2026-04-10");
    expect(target?.isUnavailable).toBe(true);
    // No other in-month day is flagged.
    const others = cells.filter(
      (c) => c.inMonth && c.dateISO !== "2026-04-10"
    );
    for (const cell of others) expect(cell.isUnavailable).toBe(false);
  });

  it("does not flag out-of-month days even if present in the unavailable set", () => {
    // Mar 30 is a leading (out-of-month) cell for April 2026.
    const weeks = buildMonthMatrix(2026, 3, new Set(["2026-03-30"]), "2026-04-15");
    const leading = weeks[0][0];
    expect(leading.dateISO).toBe("2026-03-30");
    expect(leading.inMonth).toBe(false);
    expect(leading.isUnavailable).toBe(false);
  });

  it("marks exactly one day as today", () => {
    const weeks = buildMonthMatrix(2026, 3, new Set(), "2026-04-15");
    const todays = weeks.flat().filter((c) => c.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0].dateISO).toBe("2026-04-15");
  });

  it("marks no day as today when today falls in another month", () => {
    const weeks = buildMonthMatrix(2026, 3, new Set(), "2026-05-15");
    expect(weeks.flat().filter((c) => c.isToday)).toHaveLength(0);
  });

  it("covers every calendar day of the month exactly once", () => {
    const weeks = buildMonthMatrix(2026, 3, new Set(), "2026-04-15");
    const inMonth = weeks.flat().filter((c) => c.inMonth).map((c) => c.dateISO);
    expect(inMonth).toHaveLength(30); // April
    expect(new Set(inMonth).size).toBe(30);
    expect(inMonth[0]).toBe("2026-04-01");
    expect(inMonth[29]).toBe("2026-04-30");
  });
});
