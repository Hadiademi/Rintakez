import { describe, expect, it } from "vitest";
import { MAX_TOASTS, toastDuration, toastReducer, type Toast } from "./toast-queue";

const t = (id: string, message: string, extra: Partial<Toast> = {}): Toast => ({
  id,
  message,
  variant: "success",
  ...extra,
});

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

  it("keeps the same text when the variant differs (an error is not a dup of a success)", () => {
    const state = [t("1", "Saved")];
    const next = toastReducer(state, {
      type: "add",
      toast: t("2", "Saved", { variant: "error" }),
    });
    expect(next).toHaveLength(2);
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

describe("toastDuration", () => {
  it("gives a plain confirmation a few seconds", () => {
    expect(toastDuration(t("1", "Saved"))).toBe(4000);
  });

  it("gives errors and toasts with a follow-up action time to be read and used", () => {
    expect(toastDuration(t("1", "Failed", { variant: "error" }))).toBe(6000);
    expect(
      toastDuration(t("1", "Sent", { action: { label: "View", href: "/x" } }))
    ).toBe(6000);
  });

  it("gives a longer text more time", () => {
    expect(toastDuration(t("1", "Sent", { description: "The client was notified." }))).toBe(6000);
  });
});
