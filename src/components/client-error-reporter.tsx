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
