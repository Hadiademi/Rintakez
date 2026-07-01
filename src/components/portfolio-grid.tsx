"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface PortfolioImage {
  id: string;
  url: string;
}

interface PortfolioGridProps {
  images: PortfolioImage[];
}

export function PortfolioGrid({ images }: PortfolioGridProps) {
  const [active, setActive] = useState<string | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {images.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setActive(image.url)}
            className="press group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-chip"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              loading="lazy"
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
      {active && (
        <ImageLightbox src={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
