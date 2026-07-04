"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DISMISS_COOLDOWN_MS,
  shouldShowPrompt,
  type PwaPlatform,
  type PwaPromptDecision,
} from "@/lib/pwa-prompt";

/** The (non-standard, Chromium-only) install prompt event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const VISITS_KEY = "pwa:visits";
const DISMISSED_KEY = "pwa:dismissedUntil";
const IOS_HINT_KEY = "pwa:iosHintShown";

// Sentinel for "accepted install / never show again" — far enough in the future
// that the frequency-cap check keeps the prompt permanently silent.
const NEVER = Number.MAX_SAFE_INTEGER;

function readNumber(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private mode / storage disabled — degrade silently (just don't persist).
  }
}

/**
 * Dismissible, frequency-capped PWA install affordance.
 *
 * - Chromium: catches `beforeinstallprompt`, stashes it, and offers an Install
 *   button on repeat visits.
 * - iOS Safari (no `beforeinstallprompt`): shows a one-time "Add to Home Screen"
 *   hint pointing at the Share icon.
 *
 * The show/hide decision is delegated to the pure `shouldShowPrompt`; this
 * component only wires up platform signals + localStorage persistence + UI.
 */
export function PwaInstallPrompt() {
  const t = useTranslations("pwa");
  const [decision, setDecision] = useState<PwaPromptDecision>("none");
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed / running standalone → never nag, don't count the visit.
    const installed =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (installed) return;

    // Count this load once.
    const visitCount = (readNumber(VISITS_KEY) ?? 0) + 1;
    writeNumber(VISITS_KEY, visitCount);

    const ua = window.navigator.userAgent;
    const isIosSafari =
      /iphone|ipad|ipod/i.test(ua) && !/(CriOS|FxiOS|EdgiOS)/i.test(ua);

    const decide = (platform: PwaPlatform): PwaPromptDecision =>
      shouldShowPrompt({
        platform,
        installed: false,
        visitCount,
        dismissedUntil: readNumber(DISMISSED_KEY),
        iosHintShown: window.localStorage.getItem(IOS_HINT_KEY) === "1",
        now: Date.now(),
      });

    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress Chrome's default mini-infobar; we present our own UI.
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      setDecision(decide("installable"));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const onAppInstalled = () => {
      writeNumber(DISMISSED_KEY, NEVER);
      deferredRef.current = null;
      setDecision("none");
    };
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS never fires beforeinstallprompt — evaluate the hint immediately, and
    // mark it shown so it truly appears only once.
    if (isIosSafari) {
      const iosDecision = decide("ios-safari");
      setDecision(iosDecision);
      if (iosDecision === "ios-hint") {
        try {
          window.localStorage.setItem(IOS_HINT_KEY, "1");
        } catch {
          // ignore
        }
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  function snooze() {
    writeNumber(DISMISSED_KEY, Date.now() + DISMISS_COOLDOWN_MS);
    setDecision("none");
  }

  async function handleInstall() {
    const evt = deferredRef.current;
    if (!evt) {
      snooze();
      return;
    }
    setDecision("none");
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferredRef.current = null;
    // Accepted → `appinstalled` sets the permanent flag. Dismissed → cooldown.
    if (outcome !== "accepted") {
      writeNumber(DISMISSED_KEY, Date.now() + DISMISS_COOLDOWN_MS);
    }
  }

  if (decision === "none") return null;

  const isInstall = decision === "install";
  const title = isInstall ? t("install.title") : t("ios.title");
  const body = isInstall ? t("install.body") : t("ios.body");
  const dismissLabel = isInstall ? t("install.dismiss") : t("ios.dismiss");

  return (
    // Bottom-anchored like the toaster: clears the fixed MobileTabBar (5rem)
    // plus the home-indicator safe area on mobile; bottom-right on desktop.
    <div className="fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-6 lg:bottom-6 lg:justify-end">
      <div
        role="dialog"
        aria-label={title}
        className="flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-paper p-4 shadow-lg motion-safe:animate-[toast-in_160ms_ease-out]"
      >
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-snug text-mute">{body}</p>
          {isInstall && (
            <button
              type="button"
              onClick={handleInstall}
              className="press mt-3 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-paper"
            >
              {t("install.action")}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={snooze}
          aria-label={dismissLabel}
          className="press -my-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded text-mute hover:text-ink"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
