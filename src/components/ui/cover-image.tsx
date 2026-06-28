"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Cover/hero image with a graceful fallback. When `src` is absent or fails to
 * load, it renders `fallback` (e.g. a tinted gradient band) instead of a
 * broken-image glyph — important for a photography product where missing images
 * would otherwise look broken.
 */
export function CoverImage({
  src,
  alt,
  fallback,
  className = "",
}: {
  src?: string | null;
  alt: string;
  fallback: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />
  );
}
