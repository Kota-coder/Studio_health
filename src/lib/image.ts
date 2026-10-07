function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Reads an uploaded image as a data URL, scaled down to at most `maxDimension`
 * pixels on its longest side and re-encoded as JPEG.
 *
 * Phone photos are often 3-8 MB; stored as-is they quickly exceed the browser's
 * ~5 MB storage limit and make every page that loads patients slow. Scaled to
 * 1600px they are typically 150-400 KB and still sharp enough to read ID cards.
 */
export async function imageFileToDataUrl(file: File, maxDimension = 1600, quality = 0.8): Promise<string> {
  const original = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return original;
  }
  try {
    const img = await loadImage(original);
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.fillStyle = '#fff'; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', quality);
    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}

/** Converts several uploaded images, skipping any that cannot be read. */
export async function imageFilesToDataUrls(files: File[]): Promise<string[]> {
  const results = await Promise.allSettled(files.map(file => imageFileToDataUrl(file)));
  return results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
}
