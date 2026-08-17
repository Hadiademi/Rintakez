"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/actions/observability";

/**
 * Captures uncaught client errors and unhandled promise rejections that never
 * reach a React error boundary (e.g. thrown inside event handlers or async
 * callbacks) and forwards them to the server sink. Self-limits to a handful of
 * reports per page load so a tight error loop can't flood the sink.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const MAX = 10;

    const onError = (event: ErrorEvent) => {
      if (sent >= MAX) return;
      // Cross-origin scripts (browser extensions, injected third parties)
      // surface as the masked "Script error." with no stack, file or line —
      // zero actionable signal, and by definition not our code. Sentry drops
      // these by default for the same reason; keep the alert channel
      // high-signal and skip them.
      if (
        (event.message === "Script error." || !event.message) &&
        !event.error?.stack
      ) {
        return;
      }
      sent++;
      void reportClientError({
        message: event.message || "window.onerror",
        stack: event.error?.stack,
        source: "window.onerror",
        url: window.location.href,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (sent >= MAX) return;
      sent++;
      const reason = event.reason;
      void reportClientError({
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        source: "unhandledrejection",
        url: window.location.href,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
