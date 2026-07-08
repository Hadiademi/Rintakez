import { describe, expect, it } from "vitest";
import {
  DISMISS_COOLDOWN_MS,
  MIN_VISITS_BEFORE_PROMPT,
  shouldShowPrompt,
  type PwaPromptState,
} from "./pwa-prompt";

const NOW = 1_700_000_000_000;

/** A baseline state that WOULD show the Android install banner; tests override. */
function state(overrides: Partial<PwaPromptState> = {}): PwaPromptState {
  return {
    platform: "installable",
    installed: false,
    visitCount: MIN_VISITS_BEFORE_PROMPT,
    dismissedUntil: null,
    iosHintShown: false,
    now: NOW,
    ...overrides,
  };
}

describe("shouldShowPrompt", () => {
  it("shows the install banner for an installable platform on a repeat visit", () => {
    expect(shouldShowPrompt(state())).toBe("install");
  });

  it("shows nothing on the very first visit (only nags on repeat visits)", () => {
    expect(shouldShowPrompt(state({ visitCount: 1 }))).toBe("none");
  });

  it("never shows when the app is already installed / running standalone", () => {
    expect(shouldShowPrompt(state({ installed: true }))).toBe("none");
    expect(
      shouldShowPrompt(state({ platform: "ios-safari", installed: true })),
    ).toBe("none");
  });

  it("stays hidden while inside the dismiss cooldown window", () => {
    expect(
      shouldShowPrompt(state({ dismissedUntil: NOW + 1 })),
    ).toBe("none");
  });

  it("shows again once the dismiss cooldown has elapsed", () => {
    expect(
      shouldShowPrompt(state({ dismissedUntil: NOW - 1 })),
    ).toBe("install");
  });

  it("treats a cooldown ending exactly now as elapsed", () => {
    expect(shouldShowPrompt(state({ dismissedUntil: NOW }))).toBe("install");
  });

  it("never shows again after an accepted install (far-future dismissedUntil)", () => {
    expect(
      shouldShowPrompt(
        state({ dismissedUntil: NOW + DISMISS_COOLDOWN_MS * 1000 }),
      ),
    ).toBe("none");
  });

  it("shows the iOS A2HS hint for iOS Safari when not yet shown", () => {
    expect(shouldShowPrompt(state({ platform: "ios-safari" }))).toBe(
      "ios-hint",
    );
  });

  it("shows the iOS hint only once (one-time flag)", () => {
    expect(
      shouldShowPrompt(state({ platform: "ios-safari", iosHintShown: true })),
    ).toBe("none");
  });

  it("shows nothing on a platform that is neither installable nor iOS Safari", () => {
    expect(shouldShowPrompt(state({ platform: "other" }))).toBe("none");
  });
});
