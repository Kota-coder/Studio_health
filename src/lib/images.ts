// Client-side image shrinking. Everything we store is a document or ID photo, so
// ~1200px on the long side at JPEG quality 0.7 (roughly 100-150 KB) is plenty and
// keeps storage and upload sizes small.

export const MAX_IMAGE_DIMENSION = 1200;
export const IMAGE_QUALITY = 0.7;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}

function drawScaled(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  // JPEG has no alpha; paint white so transparent PNGs don't turn black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
}

// Returns a compressed JPEG data URL for preview, OCR and later upload.
export async function compressImageFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    return drawScaled(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Captures the current camera frame as a compressed JPEG data URL.
export function captureVideoFrame(video: HTMLVideoElement): string {
  return drawScaled(video, video.videoWidth, video.videoHeight);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg';
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}

// Compresses several uploaded images, skipping any that cannot be read.
export async function compressImageFiles(files: File[]): Promise<string[]> {
  const results = await Promise.allSettled(files.map(compressImageFile));
  return results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
}
