"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { exportMyData } from "@/lib/actions/privacy";

export function DataExportButton() {
  const t = useTranslations("profile");
  const [busy, setBusy] = useState(false);

  async function onExport() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await exportMyData();
      if (!res.ok) return;
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rintakez-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={busy}
      className="press label text-mute hover:text-ink disabled:opacity-50"
    >
      {t("exportData")}
    </button>
  );
}
