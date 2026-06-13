"use client";

import { useEffect } from "react";

/**
 * Registers the hand-written service worker (`public/sw.js`) on mount so the
 * app becomes installable as a PWA. Fails silently on unsupported browsers.
 */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
