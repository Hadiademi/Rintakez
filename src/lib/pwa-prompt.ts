// Pure decision logic for the PWA install prompt. Kept free of the DOM/window so
// it can be unit-tested; the client component reads localStorage + platform
// signals, hands them to `shouldShowPrompt`, and renders accordingly.

/** The install/A2HS surface the app should render, if any. */
export type PwaPromptDecision = "install" | "ios-hint" | "none";

/**
 * Which install path is available for the current browser:
 * - `installable`  — a `beforeinstallprompt` event fired (Chrome/Android/desktop).
 * - `ios-safari`   — iOS Safari, which has no `beforeinstallprompt` (needs the
 *                    manual "Add to Home Screen" hint).
 * - `other`        — no install affordance we can offer.
 */
export type PwaPlatform = "installable" | "ios-safari" | "other";

/** Only start prompting once the visitor has come back (never on first visit). */
export const MIN_VISITS_BEFORE_PROMPT = 2;

/** After a dismiss, stay quiet for two weeks so the banner never nags. */
export const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export interface PwaPromptState {
  platform: PwaPlatform;
  /** True when already installed / running in standalone display mode. */
  installed: boolean;
  /** How many times this browser has opened the app (persisted). */
  visitCount: number;
  /** Epoch ms before which the prompt stays hidden, or null if never dismissed. */
  dismissedUntil: number | null;
  /** One-time flag: the iOS A2HS hint has already been shown. */
  iosHintShown: boolean;
  /** Current time (epoch ms), injected for testability. */
  now: number;
}

/**
 * Decide what (if anything) to show. Order matters: an installed app or a
 * first-time visitor is always silent; then the frequency cap; then the
 * per-platform surface.
 */
export function shouldShowPrompt(state: PwaPromptState): PwaPromptDecision {
  const { platform, installed, visitCount, dismissedUntil, iosHintShown, now } =
    state;

  // Already installed → never nag.
  if (installed) return "none";

  // Only prompt on repeat visits.
  if (visitCount < MIN_VISITS_BEFORE_PROMPT) return "none";

  // Frequency cap: hidden until the cooldown elapses. An accepted install sets
  // `dismissedUntil` far in the future, which keeps this permanently silent.
  if (dismissedUntil !== null && now < dismissedUntil) return "none";

  switch (platform) {
    case "installable":
      return "install";
    case "ios-safari":
      // No beforeinstallprompt on iOS: offer the manual hint exactly once.
      return iosHintShown ? "none" : "ios-hint";
    default:
      return "none";
  }
}
