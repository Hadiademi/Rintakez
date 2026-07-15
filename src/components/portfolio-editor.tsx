"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addPortfolioImage,
  removePortfolioImage,
  reorderPortfolioImages,
  setPortfolioCaption,
} from "@/lib/actions/photographer";
import { errorKey } from "@/lib/error-messages";
import { moveItem } from "@/lib/reorder";
import { ImageLightbox } from "@/components/ui/image-lightbox";

type Item = { id: string; url: string; caption: string | null };

function normalizeCaption(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function PortfolioEditor({ initial }: { initial: Item[] }) {
  const t = useTranslations("profile");
  const tOnb = useTranslations("onboarding");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<Item[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [active, setActive] = useState<Item | null>(null);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Last value persisted for each caption, so a blur only saves real changes.
  const savedCaptions = useRef<Map<string, string | null>>(
    new Map(initial.map((i) => [i.id, i.caption]))
  );

  function markLoaded(id: string) {
    setLoaded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

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
        setItems((prev) => [
          ...prev,
          { id: result.id, url: result.url, caption: null },
        ]);
        savedCaptions.current.set(result.id, null);
      } else {
        setError(tErr(errorKey(result.error)));
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onRemove(id: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(tCommon("removeConfirm"))
    ) {
      return;
    }
    setError(null);
    setRemovingId(id);
    const result = await removePortfolioImage(id);
    if (result.ok) {
      setItems((prev) => prev.filter((p) => p.id !== id));
      savedCaptions.current.delete(id);
    } else {
      setError(tErr(errorKey(result.error)));
    }
    setRemovingId(null);
  }

  // Optimistically apply a new order, revert if the server rejects it.
  async function persistOrder(next: Item[]) {
    const prev = items;
    setItems(next);
    setError(null);
    const result = await reorderPortfolioImages(next.map((i) => i.id));
    if (!result.ok) {
      setItems(prev);
      setError(tErr(errorKey(result.error)));
    }
  }

  function moveBy(index: number, delta: number) {
    const next = moveItem(items, index, index + delta);
    if (next.every((it, i) => it.id === items[i].id)) return; // no-op
    void persistOrder(next);
  }

  function onDrop(targetIndex: number) {
    const from = dragIndex;
    setDragIndex(null);
    if (from === null || from === targetIndex) return;
    void persistOrder(moveItem(items, from, targetIndex));
  }

  async function onCaptionBlur(item: Item, raw: string) {
    const desired = normalizeCaption(raw);
    if (desired === (savedCaptions.current.get(item.id) ?? null)) return;
    setError(null);
    setItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, caption: desired } : p))
    );
    const result = await setPortfolioCaption(item.id, desired);
    if (result.ok) {
      savedCaptions.current.set(item.id, desired);
    } else {
      const reverted = savedCaptions.current.get(item.id) ?? null;
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, caption: reverted } : p))
      );
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
          className="grid grid-cols-2 gap-4 sm:grid-cols-3"
          data-testid="profile-portfolio-grid"
        >
          {items.map((item, index) => {
            const removing = removingId === item.id;
            const isLoaded = loaded.has(item.id);
            return (
              <div
                key={item.id}
                data-testid="profile-portfolio-item"
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(index)}
                onDragEnd={() => setDragIndex(null)}
                className={`group flex flex-col gap-2 transition-opacity ${
                  removing ? "opacity-50" : ""
                } ${dragIndex === index ? "opacity-40" : ""} [@media(hover:hover)]:cursor-grab`}
              >
                <div className="relative aspect-square">
                  {!isLoaded && (
                    <div className="absolute inset-0 animate-pulse border border-line bg-chip" />
                  )}
                  <button
                    type="button"
                    onClick={() => setActive(item)}
                    aria-label={t("viewPhoto")}
                    className="press block h-full w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.caption ?? ""}
                      loading="lazy"
                      decoding="async"
                      onLoad={() => markLoaded(item.id)}
                      className={`aspect-square w-full border border-line object-cover grayscale transition-[filter,opacity] duration-500 group-hover:grayscale-0 ${
                        isLoaded ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    disabled={removing}
                    className="press absolute right-1 top-1 flex h-11 w-11 items-center justify-center border border-line bg-paper/80 text-xs text-ink opacity-100 transition-opacity disabled:opacity-50 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    aria-label={tCommon("remove")}
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveBy(index, -1)}
                    disabled={index === 0}
                    aria-label={t("moveUp")}
                    className="press flex h-11 w-11 items-center justify-center border border-line text-ink transition-colors hover:bg-chip disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBy(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={t("moveDown")}
                    className="press flex h-11 w-11 items-center justify-center border border-line text-ink transition-colors hover:bg-chip disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>

                <input
                  type="text"
                  defaultValue={item.caption ?? ""}
                  maxLength={280}
                  placeholder={t("captionPlaceholder")}
                  aria-label={t("captionLabel")}
                  onBlur={(e) => onCaptionBlur(item, e.target.value)}
                  className="w-full border border-line bg-surface px-2 py-1.5 text-[16px] text-ink placeholder:text-mute-2 focus:border-mute-2 focus:outline-none"
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[14px] text-mute">{t("noPortfolio")}</p>
      )}

      {error && <p className="text-[12px] text-accent">{error}</p>}

      {active && (
        <ImageLightbox
          src={active.url}
          alt={active.caption ?? undefined}
          caption={active.caption}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
