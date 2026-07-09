"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface PortfolioImage {
  id: string;
  url: string;
  caption?: string | null;
}

interface PortfolioGridProps {
  images: PortfolioImage[];
}

export function PortfolioGrid({ images }: PortfolioGridProps) {
  const [active, setActive] = useState<PortfolioImage | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {images.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setActive(image)}
            className="press group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-chip"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              loading="lazy"
              decoding="async"
              alt={image.caption ?? ""}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
      {active && (
        <ImageLightbox
          src={active.url}
          alt={active.caption ?? undefined}
          caption={active.caption}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
