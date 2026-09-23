/**
 * imageCache — the kit's per-`src` image loader + cache.
 *
 * The shape-painter chain (`kit:image` in `NodeShape.ts`) is synchronous, but
 * decoding an image is async. This module bridges the two: `getImageBitmap` is
 * a synchronous read that returns the decoded `ImageBitmap` when ready, and
 * otherwise returns `undefined` and lazily kicks off a de-duped async load.
 * When a load resolves (or errors), every `subscribeImageReady` listener fires
 * — `<SceneCanvas>` subscribes and calls `requestRedraw()`, so the painter
 * re-runs and emits the now-ready bitmap.
 *
 * `src` is any browser-loadable image string: a remote URL, a `blob:` URL, or
 * a `data:image/…;base64,…` URI (the embedded-bytes path). The decoded bitmap
 * lives only here, keyed by `src` — never in node `data` — so `scene.toJSON()`
 * round-trips the (serializable) `src` string untouched.
 */

import { maxImageTextureSide, releaseImageSource } from 'renderer/cache/GLImageCache';

/** Public shape of an image node's `data`. `src` round-trips through
 *  serialization; the decoded bitmap is held in this cache, not on the node. */
export interface ImageNodeData {
  image: {
    src: string;
    opacity?: number;
    /** The part of the bitmap drawn into the pose rect, as fractions of the
     *  bitmap's width and height from its top-left. Omitted draws the whole
     *  bitmap. Fractions, so the data means the same thing before the bitmap
     *  has decoded and after `src` is swapped for another resolution. */
    source?: { x: number; y: number; width: number; height: number };
    /** Mirror the drawn region within the pose rect. The rect does not move. */
    flipX?: boolean;
    flipY?: boolean;
  };
}

/** Where an image is in its load: never requested, in flight, decoded, or
 *  failed. Renderers paint a placeholder for anything but `'ready'`. */
export type ImageStatus = 'idle' | 'loading' | 'ready' | 'error';

/** A size in device pixels. */
export interface ImageRasterSize {
  width: number;
  height: number;
}

/** A vector source's raster bookkeeping. `scale` is the current raster's size
 *  over the natural one, always a power of two unless a cap cut it short. */
interface VectorRaster {
  natural: ImageRasterSize;
  scale: number;
  pending?: number;
  failed: Set<number>;
}

interface Entry {
  status: ImageStatus;
  bitmap?: ImageBitmap;
  vector?: VectorRaster;
}

/** `size` is absent for the first load, which decodes at natural size. */
type Loader = (src: string, size?: ImageRasterSize) => Promise<ImageBitmap>;

/** One vector raster may hold at most 64MB of RGBA. */
const MAX_VECTOR_RASTER_PIXELS = 4096 * 4096;
/** A raster is only shrunk once it is this many times larger than needed, so
 *  zooming back and forth across a bucket edge does not re-raster each way. */
const SHRINK_SLACK = 4;
// CSS default object size, as `kit:svg` measures a viewBox-only SVG.
const FALLBACK_WIDTH = 300;
const FALLBACK_HEIGHT = 150;

const cache = new Map<string, Entry>();
const subscribers = new Set<() => void>();
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

function requireDom(): void {
  if (typeof Image === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('weasel imageCache: no DOM image loader in this environment');
  }
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

const defaultLoader: Loader = async (src, size) => {
  requireDom();
  if (isVectorImageSrc(src)) return rasterizeVector(src, size);
  return createImageBitmap(await decodeImage(src));
};

let loader: Loader = defaultLoader;

function notify(): void {
  for (const cb of subscribers) cb();
}

function startLoad(src: string): void {
  const entry: Entry = { status: 'loading' };
  cache.set(src, entry);
  loader(src).then(
    (bitmap) => {
      // The entry may have been replaced/cleared mid-flight (reset, etc.);
      // only commit if this src is still the one we started loading.
      if (cache.get(src) !== entry) return;
      cache.set(src, {
        status: 'ready',
        bitmap,
        ...(isVectorImageSrc(src)
          ? { vector: { natural: { width: bitmap.width, height: bitmap.height }, scale: 1, failed: new Set<number>() } }
          : {}),
      });
      notify();
    },
    () => {
      // Cache the error so a broken `src` doesn't reload-storm.
      if (cache.get(src) !== entry) return;
      cache.set(src, { status: 'error' });
      notify();
    },
  );
}

/** The raster scale `drawnAt` calls for: the next power of two at or above the
 *  natural-to-drawn ratio, capped by texture size and the pixel ceiling. */
function rasterScaleFor(natural: ImageRasterSize, drawnAt: ImageRasterSize): number | undefined {
  const need = Math.max(drawnAt.width / natural.width, drawnAt.height / natural.height);
  if (!(need > 0) || !Number.isFinite(need)) return undefined;
  const side = maxImageTextureSide();
  const cap = Math.min(
    side / natural.width,
    side / natural.height,
    Math.sqrt(MAX_VECTOR_RASTER_PIXELS / (natural.width * natural.height)),
  );
  return Math.min(2 ** Math.ceil(Math.log2(need)), cap);
}

function maybeReraster(src: string, entry: Entry, v: VectorRaster, drawnAt: ImageRasterSize): void {
  if (v.pending !== undefined) return;
  const target = rasterScaleFor(v.natural, drawnAt);
  if (target === undefined) return;
  const grow = target > v.scale;
  if (!grow && target * SHRINK_SLACK > v.scale) return;
  for (const f of v.failed) if (target === f || (grow && f > v.scale && target >= f)) return;

  v.pending = target;
  const size = {
    width: Math.max(1, Math.round(v.natural.width * target)),
    height: Math.max(1, Math.round(v.natural.height * target)),
  };
  loader(src, size).then(
    (bitmap) => {
      if (cache.get(src) !== entry) return;
      v.pending = undefined;
      const old = entry.bitmap;
      entry.bitmap = bitmap;
      v.scale = target;
      if (old && old !== bitmap) releaseImageSource(old);
      notify();
    },
    () => {
      // The previous raster keeps painting; only this scale is given up on.
      if (cache.get(src) !== entry) return;
      v.pending = undefined;
      v.failed.add(target);
    },
  );
}

/** Synchronous read. Returns the decoded bitmap when ready; otherwise returns
 *  `undefined` and lazily starts a de-duped async load for `src`.
 *
 *  `drawnAt` is the size in device pixels the image is about to cover. A
 *  vector source ({@link isVectorImageSrc}) uses it to re-rasterize in
 *  power-of-two steps — the current raster is returned until the sharper one
 *  is ready. Raster sources ignore it. */
export function getImageBitmap(src: string, drawnAt?: ImageRasterSize): ImageBitmap | undefined {
  const entry = cache.get(src);
  if (!entry) {
    startLoad(src);
    return undefined;
  }
  if (drawnAt && entry.vector) maybeReraster(src, entry, entry.vector, drawnAt);
  return entry.bitmap;
}

/** Current load status for `src` (`'idle'` if never requested). */
export function imageStatus(src: string): ImageStatus {
  return cache.get(src)?.status ?? 'idle';
}

/** Subscribe to load-resolution events (fires after any `src` resolves or
 *  errors). Returns an unsubscribe. */
export function subscribeImageReady(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** @internal test seam — override the async loader so unit tests don't need
 *  a real DOM image. Not part of the public barrel. */
export function __setImageLoaderForTests(fn: Loader): void {
  loader = fn;
}

/** @internal test seam — clear cache + subscribers and restore the default
 *  loader. Not part of the public barrel. */
export function _resetImageCacheForTests(): void {
  cache.clear();
  subscribers.clear();
  decodedVectors.clear();
  loader = defaultLoader;
}
