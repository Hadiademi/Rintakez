"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";

/**
 * Reference images on a shoot brief. The lead image + thumbnails are clickable
 * to open a full-size preview (they're shown grayscale in the brief; the
 * lightbox shows them in full colour).
 */
export function ShootRefGallery({
  images,
}: {
  images: { id: string; url: string }[];
}) {
  const [active, setActive] = useState<string | null>(null);
  if (images.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setActive(images[0].url)}
        className="press block aspect-[16/9] w-full overflow-hidden bg-chip"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[0].url}
          alt=""
          // This lead image is the shoot-detail page's hero (it replaces the
          // fallback hero in shoots/[id]/page.tsx when reference images
          // exist), so it stays eager to avoid delaying the LCP paint.
          decoding="async"
          className="h-full w-full object-cover grayscale transition-[filter] duration-500 hover:grayscale-0"
        />
      </button>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.slice(1).map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(img.url)}
              className="press block aspect-square overflow-hidden bg-chip"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover grayscale transition-[filter] duration-500 hover:grayscale-0"
              />
            </button>
          ))}
        </div>
      )}

      {active && (
        <ImageLightbox src={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}
