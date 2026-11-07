/**
 * How the image cache turns a `src` into a bitmap. A raster decodes through an `<img>` where
 * the realm has one, and through `fetch` and `createImageBitmap` where it does not, as in a
 * worker. A vector source needs an `<img>` to draw from, so only a window rasterizes one.
 */
import type { ImageRasterSize } from './imageCache';

/** Turns `src` into a bitmap. `size` is absent for the first load, which decodes at natural
 *  size; a vector source is asked again at each size it is drawn at. */
export type ImageLoader = (src: string, size?: ImageRasterSize) => Promise<ImageBitmap>;

// CSS default object size, as `kit:svg` measures a viewBox-only SVG.
const FALLBACK_WIDTH = 300;
const FALLBACK_HEIGHT = 150;

const decodedVectors = new Map<string, Promise<HTMLImageElement>>();

/** True when `src` names SVG — a `data:image/svg+xml` URI, or a URL whose path
 *  ends in `.svg`/`.svgz`. Such sources re-rasterize at the size they are drawn
 *  at; everything else decodes once. A `blob:` URL carries no type and counts
 *  as raster. */
export function isVectorImageSrc(src: string): boolean {
  if (/^data:image\/svg\+xml[;,]/i.test(src)) return true;
  if (/^(data|blob):/i.test(src)) return false;
  return /\.svgz?$/i.test(src.replace(/[?#].*$/, ''));
}

async function decodeImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  return img;
}

function decodeVector(src: string): Promise<HTMLImageElement> {
  let decoded = decodedVectors.get(src);
  if (!decoded) {
    decoded = decodeImage(src);
    decodedVectors.set(src, decoded);
    decoded.catch(() => decodedVectors.delete(src));
  }
  return decoded;
}

/** Forget the decoded `<img>` a vector `src` rasterizes from, or every one. */
export function forgetDecodedVector(src?: string): void {
  if (src === undefined) decodedVectors.clear();
  else decodedVectors.delete(src);
}

// `createImageBitmap` rejects SVG blobs and resamples an SVG `<img>` rather
// than re-drawing it, so vectors go through a canvas `drawImage` at full size.
async function rasterizeVector(src: string, size?: ImageRasterSize): Promise<ImageBitmap> {
  const img = await decodeVector(src);
  const width = size?.width ?? (img.naturalWidth || FALLBACK_WIDTH);
  const height = size?.height ?? (img.naturalHeight || FALLBACK_HEIGHT);
  const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });
  const c2d = canvas.getContext('2d') as CanvasDrawImage | null;
  if (!c2d) throw new Error('weasel imageCache: no 2D context to rasterize an SVG');
  c2d.drawImage(img, 0, 0, width, height);
  return createImageBitmap(canvas);
}

/** `fetch` with CORS and no credentials, which is what `crossOrigin = 'anonymous'` asks of an `<img>`. */
async function fetchRaster(src: string): Promise<ImageBitmap> {
  const response = await fetch(src, { mode: 'cors', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`weasel imageCache: ${src} answered ${response.status}`);
  return createImageBitmap(await response.blob());
}

/** The cache's own loader: what {@link setImageLoader} replaces, and what a replacement can
 *  fall back on for the sources it does not handle itself. */
export const loadImageBitmap: ImageLoader = async (src, size) => {
  if (typeof createImageBitmap === 'undefined') {
    throw new Error('weasel imageCache: no image decoder in this environment');
  }
  const hasImg = typeof Image !== 'undefined';
  if (isVectorImageSrc(src)) {
    if (!hasImg) throw new Error('weasel imageCache: an SVG source needs a window to rasterize it');
    return rasterizeVector(src, size);
  }
  return hasImg ? createImageBitmap(await decodeImage(src)) : fetchRaster(src);
};
