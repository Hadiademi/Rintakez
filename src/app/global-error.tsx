"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/actions/observability";

// Root error boundary — catches failures in the root layout itself (above the
// locale provider), so it cannot use next-intl. Kept intentionally minimal.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError({
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      source: "boundary:global",
    });
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#fff",
          color: "#111",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 500 }}>
          Something went wrong.
        </h1>
        <button
          onClick={reset}
          style={{
            background: "#111",
            color: "#fff",
            padding: "0.625rem 1.25rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
