import { describe, expect, it } from "vitest";
import { errorKey } from "./error-messages";

describe("errorKey", () => {
  it("returns known code as-is", () => {
    expect(errorKey("already_bid")).toBe("already_bid");
    expect(errorKey("already_reviewed")).toBe("already_reviewed");
  });

  it("returns unauthorized as-is", () => {
    expect(errorKey("unauthorized")).toBe("unauthorized");
  });

  it("collapses raw DB error to generic", () => {
    expect(
      errorKey('duplicate key value violates unique constraint "x"')
    ).toBe("generic");
  });

  it("collapses empty string to generic", () => {
    expect(errorKey("")).toBe("generic");
  });
});
