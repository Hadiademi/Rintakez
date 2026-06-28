"use client";

import { useState } from "react";
import { initials as toInitials } from "@/lib/name";

/**
 * Round avatar with a graceful fallback: if the image is missing or fails to
 * load (deleted file, network error), it falls back to the person's initials
 * instead of a broken-image glyph. Use everywhere a user image appears.
 */
export function Avatar({
  name,
  src,
  size = 48,
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-chip text-mute ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={name}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover grayscale"
        />
      ) : (
        <span
          className="font-medium"
          style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}
        >
          {toInitials(name)}
        </span>
      )}
    </span>
  );
}
