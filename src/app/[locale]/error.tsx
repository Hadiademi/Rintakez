"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { captureError } from "@/lib/observability";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("states");

  useEffect(() => {
    captureError(error, { digest: error.digest, boundary: "locale" });
  }, [error]);
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-paper text-ink px-6 text-center">
      <h1 className="text-xl font-medium">{t("errorTitle")}</h1>
      <button onClick={reset} className="press bg-ink text-paper px-5 py-2.5">
        {t("errorRetry")}
      </button>
    </main>
  );
}
