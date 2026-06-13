"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { uploadAvatar } from "@/lib/actions/profile";
import { errorKey } from "@/lib/error-messages";

export function AvatarUploader({
  initialUrl,
  initials,
}: {
  initialUrl: string | null;
  initials: string;
}) {
  const t = useTranslations("profile");
  const tErr = useTranslations("errors");
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadAvatar(fd);
    setBusy(false);
    if (result.ok) {
      // cache-bust so the <img> refreshes even if the URL host is the same
      setUrl(`${result.url}?t=${Date.now()}`);
    } else {
      setError(tErr(errorKey(result.error)));
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="press group relative h-16 w-16 overflow-hidden rounded-full border border-line"
        aria-label={t("changePhoto")}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover grayscale"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-chip text-[18px] font-medium text-mute">
            {initials}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-ink/55 opacity-0 transition-opacity group-hover:opacity-100">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="text-paper"
          >
            <path d="M3 7h3l2-2h8l2 2h3v12H3z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        data-testid="avatar-input"
        onChange={onPick}
        disabled={busy}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="label press text-mute hover:text-ink"
      >
        {busy ? "…" : t("changePhoto")}
      </button>

      {error && <p className="text-[12px] text-accent">{error}</p>}
    </div>
  );
}
