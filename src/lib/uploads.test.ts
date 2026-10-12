import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, isAllowedImage } from "@/lib/uploads";

// The storage buckets enforce the same list (20261013120000_db_hardening.sql).
// If the app accepted a type the bucket refuses, the upload would fail as a
// generic error (and page the owner) instead of a clear "invalid file".
describe("upload rules", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20261013120000_db_hardening.sql"),
    "utf8"
  );

  it("match the storage buckets' MIME allowlist exactly", () => {
    const m = /allowed_mime_types = array\[([^\]]+)\]/.exec(migration);
    expect(m).not.toBeNull();
    const bucketTypes = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    expect([...ALLOWED_IMAGE_TYPES].sort()).toEqual(bucketTypes);
  });

  it("match the storage buckets' size limit", () => {
    expect(migration).toContain("file_size_limit = 5 * 1024 * 1024");
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });

  it("accept phone and web images, refuse everything else", () => {
    const file = (type: string, size = 1000) => ({ type, size });
    for (const ok of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(isAllowedImage(file(ok)), ok).toBe(true);
    }
    for (const bad of ["image/svg+xml", "image/bmp", "image/tiff", "text/html", "application/pdf", ""]) {
      expect(isAllowedImage(file(bad)), bad).toBe(false);
    }
    expect(isAllowedImage(file("image/jpeg", 0))).toBe(false);
    expect(isAllowedImage(file("image/jpeg", MAX_UPLOAD_BYTES + 1))).toBe(false);
    expect(isAllowedImage(file("image/jpeg", MAX_UPLOAD_BYTES))).toBe(true);
  });
});
