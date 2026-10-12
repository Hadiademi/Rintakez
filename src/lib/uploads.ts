/**
 * What an uploaded image may be. The storage buckets enforce the same rules
 * (20261013120000_db_hardening.sql; uploads.test.ts keeps the two in step),
 * so a file the app accepts is never refused by storage as a generic error.
 * Browsers re-encode to JPEG before upload (downscaleImage); the other types
 * cover originals they could not decode, e.g. HEIC from an iPhone. SVG is
 * deliberately absent: it can carry script.
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
] as const;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isAllowedImage(file: { type: string; size: number }): boolean {
  return (
    file.size > 0 &&
    file.size <= MAX_UPLOAD_BYTES &&
    (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)
  );
}
