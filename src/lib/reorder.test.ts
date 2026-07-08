import { describe, expect, it } from "vitest";
import { moveItem } from "./reorder";

describe("moveItem", () => {
  it("moves an item forward to a later index", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward to an earlier index", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("moves an item up by one (swap with previous)", () => {
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
  });

  it("returns an unchanged copy when from === to", () => {
    const input = ["a", "b", "c"];
    const out = moveItem(input, 1, 1);
    expect(out).toEqual(["a", "b", "c"]);
    expect(out).not.toBe(input);
  });

  it("clamps an out-of-range target to the last index", () => {
    expect(moveItem(["a", "b", "c"], 0, 9)).toEqual(["b", "c", "a"]);
  });

  it("returns an unchanged copy for an out-of-range source", () => {
    expect(moveItem(["a", "b", "c"], 5, 0)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    moveItem(input, 0, 2);
    expect(input).toEqual(["a", "b", "c"]);
  });
});
