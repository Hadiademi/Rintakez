import { describe, expect, it } from "vitest";
import {
  hasSeenMoment,
  markMomentSeen,
  momentKey,
  shouldCelebrateCompletion,
  type MomentStorage,
} from "./moment-once";

function memoryStorage(): MomentStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const broken: MomentStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("moment once-only memory", () => {
  it("namespaces the key", () => {
    expect(momentKey("won:abc")).toBe("framly:moment:won:abc");
  });

  it("is unseen until marked, then seen", () => {
    const s = memoryStorage();
    expect(hasSeenMoment(s, "won:1")).toBe(false);
    markMomentSeen(s, "won:1");
    expect(hasSeenMoment(s, "won:1")).toBe(true);
    expect(hasSeenMoment(s, "won:2")).toBe(false);
  });

  it("treats unavailable storage as seen, so a moment can't repeat on every visit", () => {
    expect(hasSeenMoment(null, "won:1")).toBe(true);
    expect(hasSeenMoment(broken, "won:1")).toBe(true);
    expect(() => markMomentSeen(broken, "won:1")).not.toThrow();
  });
});

describe("shouldCelebrateCompletion", () => {
  it("celebrates reaching 100% only after this device saw the profile incomplete", () => {
    const s = memoryStorage();
    expect(shouldCelebrateCompletion(s, "u1", 60)).toBe(false);
    expect(shouldCelebrateCompletion(s, "u1", 100)).toBe(true);
  });

  it("never celebrates a profile that was already complete (no surprise party for old accounts)", () => {
    const s = memoryStorage();
    expect(shouldCelebrateCompletion(s, "u1", 100)).toBe(false);
  });

  it("celebrates once; dropping below 100 and back does not repeat it", () => {
    const s = memoryStorage();
    shouldCelebrateCompletion(s, "u1", 80);
    expect(shouldCelebrateCompletion(s, "u1", 100)).toBe(true);
    markMomentSeen(s, "profile-complete:u1");
    shouldCelebrateCompletion(s, "u1", 90);
    expect(shouldCelebrateCompletion(s, "u1", 100)).toBe(false);
  });

  it("is per user", () => {
    const s = memoryStorage();
    shouldCelebrateCompletion(s, "u1", 50);
    expect(shouldCelebrateCompletion(s, "u2", 100)).toBe(false);
  });

  it("stays quiet without storage", () => {
    expect(shouldCelebrateCompletion(null, "u1", 100)).toBe(false);
    expect(shouldCelebrateCompletion(broken, "u1", 100)).toBe(false);
  });
});
