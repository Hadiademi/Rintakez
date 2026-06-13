"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addPortfolioImage,
  removePortfolioImage,
} from "@/lib/actions/photographer";
import { errorKey } from "@/lib/error-messages";

type Item = { id: string; url: string };

export function PortfolioEditor({ initial }: { initial: Item[] }) {
  const t = useTranslations("profile");
  const tOnb = useTranslations("onboarding");
  const tErr = useTranslations("errors");
  const [items, setItems] = useState<Item[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const result = await addPortfolioImage(fd);
      if (result.ok) {
        setItems((prev) => [...prev, { id: result.id, url: result.url }]);
      } else {
        setError(tErr(errorKey(result.error)));
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onRemove(id: string) {
    const result = await removePortfolioImage(id);
    if (result.ok) {
      setItems((prev) => prev.filter((p) => p.id !== id));
    } else {
      setError(tErr(errorKey(result.error)));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="label text-mute">{t("portfolio")}</p>
        <label className="press inline-flex cursor-pointer items-center gap-2 border border-line px-4 py-2 text-[13px] text-mute hover:text-ink">
          {uploading ? "…" : tOnb("addPhotos")}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            data-testid="profile-portfolio-input"
            onChange={onPick}
            disabled={uploading}
          />
        </label>
      </div>

      {items.length > 0 ? (
        <div
          className="grid grid-cols-3 gap-3 sm:grid-cols-4"
          data-testid="profile-portfolio-grid"
        >
          {items.map((item) => (
            <div key={item.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                className="aspect-square w-full border border-line object-cover grayscale transition-[filter] duration-500 group-hover:grayscale-0"
              />
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="press absolute right-1 top-1 border border-line bg-paper/80 px-1.5 py-0.5 text-xs text-ink opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-mute">{t("noPortfolio")}</p>
      )}

      {error && <p className="text-[12px] text-accent">{error}</p>}
    </div>
  );
}
