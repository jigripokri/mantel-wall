/**
 * Downscale a photo before upload.
 *
 * Phone photos are 3–5 MB and 4000px wide; the wall is 1920 logical px (3840 on
 * the Frame) and the Pi signs and paints these over wifi. Uploading raw would
 * make it stutter on every load. We cap the long edge and re-encode as JPEG.
 *
 * `createImageBitmap(..., { imageOrientation: "from-image" })` bakes in EXIF
 * rotation, so portrait phone shots don't land sideways on the wall — the one
 * thing a naive canvas draw gets wrong.
 */
export async function resizeImage(
  file: File,
  maxEdge = 2560,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("could not encode image"))),
      "image/jpeg",
      quality,
    );
  });
}
