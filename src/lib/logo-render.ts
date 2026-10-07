// Turns a logo (designed SVG or uploaded image) into the PNG files a hospital's branding
// needs: the logo itself and the app/browser icons. Runs in the browser (canvas).

import { tint } from '@/lib/branding';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image. Try a PNG or JPG file.'));
    img.src = src;
  });
}

export const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
}

// Draws img centred in a size×size square, scaled to fit `scale` of it, on an optional background.
async function render(img: HTMLImageElement, size: number, scale: number, background?: string, radius = 0): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot create images.');
  if (background) {
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();
  }
  const box = size * scale;
  const ratio = Math.min(box / (img.naturalWidth || box), box / (img.naturalHeight || box));
  const w = (img.naturalWidth || box) * ratio;
  const h = (img.naturalHeight || box) * ratio;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvasToPng(canvas);
}

// logo.png keeps a transparent background; icons sit on white (maskable on a pale tint of
// the brand colour, with room for the phone's mask).
export async function brandingFiles(logoSrc: string, brandColor: string): Promise<Record<string, Blob>> {
  const img = await loadImage(logoSrc);
  return {
    'logo.png': await render(img, 512, 1),
    'icon-192.png': await render(img, 192, 0.82, '#ffffff', 40),
    'icon-512.png': await render(img, 512, 0.82, '#ffffff', 104),
    'maskable-512.png': await render(img, 512, 0.6, tint(brandColor, 0.9)),
    'apple-icon.png': await render(img, 180, 0.76, '#ffffff'),
  };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
