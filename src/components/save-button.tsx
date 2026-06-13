"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleFavorite } from "@/lib/actions/favorites";

export function SaveButton({
  photographerId,
  initialSaved,
}: {
  photographerId: string;
  initialSaved: boolean;
}) {
  const t = useTranslations("profile");
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  function onToggle() {
    // Optimistic.
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await toggleFavorite(photographerId);
      if (!res.ok) setSaved(!next);
      else setSaved(res.favorited);
    });
  }

  return (
    <button
      type="button"
      data-testid="save-photographer"
      onClick={onToggle}
      disabled={isPending}
      aria-pressed={saved}
      className={`press inline-flex items-center gap-2 border px-4 py-2 text-sm transition-colors ${
        saved
          ? "border-ink bg-ink text-paper"
          : "border-line text-ink hover:border-ink"
      }`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
      {saved ? t("saved") : t("save")}
    </button>
  );
}
