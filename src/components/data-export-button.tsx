"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { exportMyData } from "@/lib/actions/privacy";

export function DataExportButton() {
  const t = useTranslations("profile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await exportMyData();
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rintakez-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onExport}
        disabled={busy}
        className="press label text-mute hover:text-ink disabled:opacity-50"
      >
        {busy ? t("exporting") : t("exportData")}
      </button>
      {error && <p className="text-[12px] text-accent">{error}</p>}
    </div>
  );
}
