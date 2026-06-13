"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/** Editorial nav search — routes to the browse page filtered by title query.
 *  Browse reads ?q to do a case-insensitive title match. */
export function NavSearch({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/shoots?q=${encodeURIComponent(query)}` : "/shoots");
  }

  return (
    <form
      onSubmit={submit}
      className={`flex items-center gap-2.5 border border-line bg-surface px-3.5 py-2.5 ${className}`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="shrink-0 text-mute-2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="w-full bg-transparent text-sm text-ink placeholder:text-mute-2 focus:outline-none"
      />
    </form>
  );
}
