import { describe, expect, it } from "vitest";
import { firstPathPerShoot, type ShootImageRow } from "./shoot-cover";

const row = (
  shoot_id: string,
  storage_path: string,
  sort_order = 0,
  created_at = "2026-01-01T00:00:00Z"
): ShootImageRow => ({ shoot_id, storage_path, sort_order, created_at });

describe("firstPathPerShoot", () => {
  it("returns an empty map for no rows", () => {
    expect(firstPathPerShoot([]).size).toBe(0);
  });

  it("picks the lowest sort_order per shoot", () => {
    const map = firstPathPerShoot([
      row("s1", "b.png", 2),
      row("s1", "a.png", 0),
      row("s1", "c.png", 1),
    ]);
    expect(map.get("s1")).toBe("a.png");
  });

  it("breaks sort_order ties by oldest created_at (the first upload)", () => {
    const map = firstPathPerShoot([
      row("s1", "later.png", 0, "2026-02-02T00:00:00Z"),
      row("s1", "first.png", 0, "2026-02-01T00:00:00Z"),
    ]);
    expect(map.get("s1")).toBe("first.png");
  });

  it("keeps shoots independent", () => {
    const map = firstPathPerShoot([
      row("s1", "one.png", 5),
      row("s2", "two.png", 0),
    ]);
    expect(map.get("s1")).toBe("one.png");
    expect(map.get("s2")).toBe("two.png");
    expect(map.size).toBe(2);
  });
});
