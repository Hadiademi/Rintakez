"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * Full-screen image preview. Click the backdrop, press Escape, or hit the close
 * button to dismiss. Shown only after a user interaction (client-only), so no
 * SSR/portal concerns. Locks body scroll while open.
 */
export function ImageLightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt?: string;
  caption?: string | null;
  onClose: () => void;
}) {
  const tCommon = useTranslations("common");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm sm:p-8"
    >
      <figure
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] max-w-full flex-col items-center gap-3 sm:max-w-[88vw]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ""}
          className="min-h-0 max-w-full flex-1 rounded object-contain shadow-2xl"
        />
        {caption && (
          <figcaption className="max-w-2xl text-center text-[14px] leading-relaxed text-paper/90">
            {caption}
          </figcaption>
        )}
      </figure>
      <button
        type="button"
        onClick={onClose}
        aria-label={tCommon("close")}
        className="press absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-paper/90 text-xl leading-none text-ink shadow-lg hover:bg-paper"
      >
        ✕
      </button>
    </div>
  );
}
