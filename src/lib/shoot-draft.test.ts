import { describe, expect, it } from "vitest";
import {
  draftKey,
  deserializeDraft,
  isMeaningfulDraft,
  pickDraftValues,
  serializeDraft,
} from "./shoot-draft";

describe("draftKey", () => {
  it("namespaces the key per user id", () => {
    expect(draftKey("abc-123")).toBe("rintakez:shoot-draft:abc-123");
  });
});

describe("pickDraftValues", () => {
  it("keeps only persistable fields and drops unknown keys", () => {
    const picked = pickDraftValues({
      title: "Wedding",
      locationCity: "Zürich",
      // not part of the draft schema — must be dropped
      refImages: [{ file: {}, url: "blob:x" }],
      somethingElse: 42,
    } as Record<string, unknown>);
    expect(picked).toEqual({ title: "Wedding", locationCity: "Zürich" });
  });

  it("drops undefined and NaN numeric fields (empty number inputs)", () => {
    const picked = pickDraftValues({
      title: "Shoot",
      budgetMinChf: Number.NaN,
      budgetMaxChf: undefined,
      durationHours: 6,
    } as Record<string, unknown>);
    expect(picked).toEqual({ title: "Shoot", durationHours: 6 });
  });
});

describe("isMeaningfulDraft", () => {
  it("returns false for an all-default draft (untouched form)", () => {
    expect(isMeaningfulDraft({ discipline: "photo", durationHours: 4 })).toBe(
      false
    );
  });

  it("returns false for an empty object", () => {
    expect(isMeaningfulDraft({})).toBe(false);
  });

  it("returns true once the user picks a shoot type", () => {
    expect(
      isMeaningfulDraft({ discipline: "photo", durationHours: 4, type: "wedding" })
    ).toBe(true);
  });

  it("returns true once a text field has content", () => {
    expect(
      isMeaningfulDraft({ discipline: "photo", durationHours: 4, locationCity: "Bern" })
    ).toBe(true);
  });

  it("returns true when a default field is changed away from its default", () => {
    expect(
      isMeaningfulDraft({ discipline: "video", durationHours: 4 })
    ).toBe(true);
    expect(
      isMeaningfulDraft({ discipline: "photo", durationHours: 8 })
    ).toBe(true);
  });

  it("treats empty strings as not meaningful", () => {
    expect(
      isMeaningfulDraft({ discipline: "photo", durationHours: 4, title: "" })
    ).toBe(false);
  });
});

describe("serializeDraft / deserializeDraft round-trip", () => {
  it("round-trips values and step through storage", () => {
    const raw = serializeDraft(
      { title: "Wedding", locationCity: "Zürich", discipline: "photo", durationHours: 4 },
      1
    );
    expect(deserializeDraft(raw)).toEqual({
      values: {
        title: "Wedding",
        locationCity: "Zürich",
        discipline: "photo",
        durationHours: 4,
      },
      step: 1,
    });
  });

  it("returns null for null / empty input", () => {
    expect(deserializeDraft(null)).toBeNull();
    expect(deserializeDraft("")).toBeNull();
  });

  it("returns null (never throws) for malformed JSON", () => {
    expect(deserializeDraft("{not json")).toBeNull();
  });

  it("returns null for a non-object payload", () => {
    expect(deserializeDraft("42")).toBeNull();
    expect(deserializeDraft("null")).toBeNull();
  });

  it("clamps an out-of-range or missing step to 0", () => {
    expect(deserializeDraft(JSON.stringify({ values: { title: "x" } }))).toEqual({
      values: { title: "x" },
      step: 0,
    });
    expect(
      deserializeDraft(JSON.stringify({ values: { title: "x" }, step: 99 }))
    ).toEqual({ values: { title: "x" }, step: 0 });
  });

  it("ignores unknown persisted keys on the way back in", () => {
    const raw = JSON.stringify({
      values: { title: "x", hacked: true },
      step: 2,
    });
    expect(deserializeDraft(raw)).toEqual({ values: { title: "x" }, step: 2 });
  });
});
