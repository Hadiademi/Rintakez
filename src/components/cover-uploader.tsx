"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setCoverImage, removeCover } from "@/lib/actions/photographer";

export function CoverUploader({ initialUrl }: { initialUrl: string | null }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await setCoverImage(fd);
    if (res.ok) {
      setUrl(res.url);
      router.refresh();
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onRemove() {
    setBusy(true);
    const res = await removeCover();
    if (res.ok) {
      setUrl(null);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <p className="label text-mute">{t("coverTitle")}</p>
      <div className="relative h-40 w-full overflow-hidden border border-line bg-chip sm:h-48">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover grayscale" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-surface via-chip to-surface" />
        )}
      </div>
      <div className="flex items-center gap-3">
        <label className="press inline-flex cursor-pointer items-center gap-2 border border-line px-4 py-2 text-sm text-ink">
          {busy ? "…" : url ? t("coverReplace") : t("coverUpload")}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onFile}
            disabled={busy}
          />
        </label>
        {url && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="press label text-mute hover:text-ink disabled:opacity-50"
          >
            {t("coverRemove")}
          </button>
        )}
      </div>
    </div>
  );
}
