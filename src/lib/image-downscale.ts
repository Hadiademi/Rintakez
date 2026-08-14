// Client-side image downscaling before upload.
//
// Phone photos are 3–8MB; uploading originals over a mobile uplink is what
// makes "add photo" feel slow, and the server/storage never needs more pixels
// than the largest rendering (~2000px). Chat photos have always shipped
// through this canvas downscale — extracted here so avatar/cover/portfolio
// uploads get the same treatment (~10× smaller payloads).
//
// EXIF orientation is honoured via createImageBitmap's `imageOrientation`.
// Falls back to the original file when the browser can't decode/encode it —
// the server still guards size + MIME either way.

export async function downscaleImage(
  file: File,
  maxDim = 2000,
  quality = 0.85
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDim / longest);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
