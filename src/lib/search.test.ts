import { describe, expect, it } from "vitest";
import { escapeIlike, highlightSegments } from "./search";

describe("escapeIlike", () => {
  it("leaves plain text untouched", () => {
    expect(escapeIlike("mar")).toBe("mar");
  });

  it("escapes the % wildcard so it matches literally", () => {
    expect(escapeIlike("50%")).toBe("50\\%");
  });

  it("escapes the _ single-char wildcard", () => {
    expect(escapeIlike("a_b")).toBe("a\\_b");
  });

  it("escapes a literal backslash", () => {
    expect(escapeIlike("a\\b")).toBe("a\\\\b");
  });

  it("escapes backslash before wildcards (no double-escaping)", () => {
    // input: \%  -> backslash then percent, each escaped independently
    expect(escapeIlike("\\%")).toBe("\\\\\\%");
  });

  it("escapes all wildcards in a mixed string", () => {
    expect(escapeIlike("100%_off")).toBe("100\\%\\_off");
  });
});

describe("highlightSegments", () => {
  it("splits a leading match from the rest", () => {
    expect(highlightSegments("Marko", "mar")).toEqual([
      { text: "Mar", match: true },
      { text: "ko", match: false },
    ]);
  });

  it("is case-insensitive but preserves original casing", () => {
    expect(highlightSegments("MARKO", "mar")).toEqual([
      { text: "MAR", match: true },
      { text: "KO", match: false },
    ]);
  });

  it("returns a single unmatched segment when there is no match", () => {
    expect(highlightSegments("Hello", "xyz")).toEqual([
      { text: "Hello", match: false },
    ]);
  });

  it("returns the whole string unmatched for an empty query", () => {
    expect(highlightSegments("Hello", "")).toEqual([
      { text: "Hello", match: false },
    ]);
  });

  it("highlights every non-overlapping occurrence", () => {
    expect(highlightSegments("banana", "an")).toEqual([
      { text: "b", match: false },
      { text: "an", match: true },
      { text: "an", match: true },
      { text: "a", match: false },
    ]);
  });

  it("handles a match in the middle", () => {
    expect(highlightSegments("a Marko b", "mark")).toEqual([
      { text: "a ", match: false },
      { text: "Mark", match: true },
      { text: "o b", match: false },
    ]);
  });
});
