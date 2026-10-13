// One-shot confirmations that must survive a redirect into the app (the email
// link lands on a route handler; the password reset lives in another layout),
// carried as ?flash=<key> and shown as a toast by <FlashToast>. The value is
// user-controlled, so only known keys are ever rendered.

export const FLASH_KEYS = ["passwordUpdated", "emailConfirmed"] as const;
export type FlashKey = (typeof FLASH_KEYS)[number];

export function isFlashKey(value: string | null): value is FlashKey {
  return value !== null && (FLASH_KEYS as readonly string[]).includes(value);
}

/**
 * What a successfully verified email link should confirm, if anything. Only a
 * sign-up is a "welcome": an email change needs a link from BOTH addresses
 * (double_confirm_changes), so the first one doesn't finish anything.
 */
export function flashForOtpType(type: string | null): FlashKey | null {
  return type === "signup" || type === "email" ? "emailConfirmed" : null;
}

export function withFlash(url: URL, key: FlashKey): URL {
  const next = new URL(url);
  next.searchParams.set("flash", key);
  return next;
}
