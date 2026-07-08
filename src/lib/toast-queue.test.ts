import { describe, expect, it } from "vitest";
import { MAX_TOASTS, toastReducer, type Toast } from "./toast-queue";

const t = (id: string, message: string): Toast => ({ id, message });

describe("toastReducer", () => {
  it("appends an added toast to the queue", () => {
    const next = toastReducer([], { type: "add", toast: t("1", "Saved") });
    expect(next).toEqual([t("1", "Saved")]);
  });

  it("ignores a duplicate message already in the queue (dedup)", () => {
    const state = [t("1", "Saved")];
    const next = toastReducer(state, { type: "add", toast: t("2", "Saved") });
    expect(next).toEqual([t("1", "Saved")]);
    expect(next).toBe(state); // unchanged reference — no re-render churn
  });

  it("keeps distinct messages", () => {
    let state: Toast[] = [];
    state = toastReducer(state, { type: "add", toast: t("1", "A") });
    state = toastReducer(state, { type: "add", toast: t("2", "B") });
    expect(state).toEqual([t("1", "A"), t("2", "B")]);
  });

  it(`caps the queue at ${MAX_TOASTS}, dropping the oldest`, () => {
    let state: Toast[] = [];
    state = toastReducer(state, { type: "add", toast: t("1", "A") });
    state = toastReducer(state, { type: "add", toast: t("2", "B") });
    state = toastReducer(state, { type: "add", toast: t("3", "C") });
    state = toastReducer(state, { type: "add", toast: t("4", "D") });
    expect(state).toEqual([t("2", "B"), t("3", "C"), t("4", "D")]);
    expect(state).toHaveLength(MAX_TOASTS);
  });

  it("dismisses a toast by id", () => {
    const state = [t("1", "A"), t("2", "B")];
    const next = toastReducer(state, { type: "dismiss", id: "1" });
    expect(next).toEqual([t("2", "B")]);
  });

  it("is a no-op when dismissing an unknown id", () => {
    const state = [t("1", "A")];
    const next = toastReducer(state, { type: "dismiss", id: "nope" });
    expect(next).toEqual([t("1", "A")]);
  });
});
