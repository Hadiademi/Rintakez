"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Cover/hero image with a graceful fallback. When `src` is absent or fails to
 * load, it renders `fallback` (e.g. a tinted gradient band) instead of a
 * broken-image glyph — important for a photography product where missing images
 * would otherwise look broken.
 *
 * Defaults to `loading="lazy"` + `decoding="async"` since most callers (e.g.
 * directory/grid cards) render below the fold. Pass `priority` for
 * above-the-fold hero usage so the browser fetches it eagerly instead.
 */
export function CoverImage({
  src,
  alt,
  fallback,
  className = "",
  width,
  height,
  priority = false,
}: {
  src?: string | null;
  alt: string;
  fallback: ReactNode;
  className?: string;
  width?: number;
  height?: number;
  /** Above-the-fold hero usage — fetch eagerly instead of lazily. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={className}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
