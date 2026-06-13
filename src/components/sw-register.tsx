"use client";

import { useEffect } from "react";

/**
 * In production: registers the hand-written service worker (`public/sw.js`) so
 * the app is installable as a PWA.
 *
 * In development: a service worker would serve stale cached chunks across
 * rebuilds and break the page in Chrome/Firefox. So here we actively UNREGISTER
 * any previously-installed worker and clear its caches — this self-heals
 * browsers that registered the SW during an earlier session.
 */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      return;
    }

    // Development: tear down any existing service worker + caches.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => keys.forEach((k) => caches.delete(k)))
        .catch(() => {});
    }
  }, []);

  return null;
}
