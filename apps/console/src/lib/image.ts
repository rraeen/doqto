/** The picture types the API accepts for a profile photo. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Shrinks a photo to at most `max` pixels on its longer side and re-encodes it as JPEG, so a phone
 * picture of several megabytes fits the 2 MB limit. If the browser cannot do it the original is
 * returned and the API decides.
 */
export async function shrinkPhoto(file: File, max = 900): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
