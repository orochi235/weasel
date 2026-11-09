/**
 * The kit's per-`src` image loader + cache. Shape painters are synchronous
 * and decoding an image is async, so `getImageBitmap` is a synchronous read
 * that returns the decoded `ImageBitmap` when ready, and otherwise returns
 * `undefined` and lazily kicks off a de-duped async load. When a load
 * resolves (or errors), every `subscribeImageReady` listener fires.
 *
 * `src` is any browser-loadable image string: a remote URL, a `blob:` URL, or
 * a `data:image/…;base64,…` URI. The decoded bitmap lives only here, keyed by
 * `src` — never in node `data`. The cache owns it, and closes it when it drops
 * it, so a bitmap taken from the cache is valid only until then.
 */

import { createEmitter } from '@weasel-js/registry';
import { imageSourceInLatestFrame, maxImageTextureSide, releaseImageSource } from '../cache/GLImageCache';
import { forgetDecodedVector, isVectorImageSrc, loadImageBitmap, type ImageLoader } from './imageLoader';

export { isVectorImageSrc };

/** Public shape of an image node's `data`. `src` round-trips through
 *  serialization; the decoded bitmap is held in this cache, not on the node. */
export interface ImageNodeData {
  image: {
    src: string;
    /** A `src` drawn in this one's place while it decodes, so swapping a
     *  picture does not flash the loading placeholder. Read only once it has
     *  decoded; never loaded on its own account. */
    previous?: string;
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
  /** The scale the last shrink left, until something asks for more. */
  shrunkTo?: number;
  /** The largest scale a shrunk raster was asked to grow back to. One raster
   *  serves every size a source is drawn at, so that request may be a second
   *  consumer the shrink starved; shrinking below it again would loop. */
  floor: number;
}

interface Entry {
  status: ImageStatus;
  bitmap?: ImageBitmap;
  vector?: VectorRaster;
  /** The value of `reads` when this entry was last read. */
  readAt: number;
}

/** One vector raster may hold at most 64MB of RGBA. */
const MAX_VECTOR_RASTER_PIXELS = 4096 * 4096;
/** A raster is only shrunk once it is this many times larger than needed, so
 *  zooming back and forth across a bucket edge does not re-raster each way. */
const SHRINK_SLACK = 4;

/** Decoded RGBA the cache holds before it starts dropping images: 256MB. */
const DEFAULT_BUDGET_BYTES = 256 * 1024 * 1024;

const cache = new Map<string, Entry>();
let budgetBytes = DEFAULT_BUDGET_BYTES;
let reads = 0;
/** `reads` as the last {@link enforceBudget} left it. */
let readsAtLastPass = 0;
let ready = createEmitter();

let loader: ImageLoader = loadImageBitmap;

/** Replace how a `src` becomes a bitmap, for a realm the cache's own loader cannot serve —
 *  a worker has no `<img>` to rasterize an SVG with. `null` puts back {@link loadImageBitmap}.
 *  Images already loaded stay; the next load goes through `fn`. */
export function setImageLoader(fn: ImageLoader | null): void {
  loader = fn ?? loadImageBitmap;
}

function notify(): void {
  ready.emit();
}

/** Open {@link holdImageBitmaps} holds, and the bitmaps dropped while one is open. */
let holds = 0;
let closeLater = new Set<ImageBitmap>();

/**
 * Free `bitmap`'s textures and close it: the cache owns every bitmap it loads
 * or adopts. While a {@link holdImageBitmaps} hold is open the close waits.
 */
function dispose(bitmap: ImageBitmap): void {
  releaseImageSource(bitmap);
  if (holds > 0) closeLater.add(bitmap);
  else bitmap.close();
}

/** Whether an entry still holds `bitmap`, which a deferred close must then leave open. */
function cached(bitmap: ImageBitmap): boolean {
  for (const entry of cache.values()) if (entry.bitmap === bitmap) return true;
  return false;
}

/**
 * Keep every bitmap the cache drops open until the returned release is
 * called. A bitmap taken from the cache is valid only until the cache drops
 * it; work that holds draw commands across an `await` — an export — holds
 * this around itself. Dropping still frees the bitmap's textures and its
 * place in the budget at once. Release is idempotent.
 */
export function holdImageBitmaps(): () => void {
  holds++;
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    if (--holds > 0) return;
    const pending = closeLater;
    closeLater = new Set();
    for (const bitmap of pending) if (!cached(bitmap)) bitmap.close();
  };
}

const bytesOf = (bitmap: ImageBitmap | undefined): number =>
  (bitmap ? bitmap.width * bitmap.height * 4 : 0);

/**
 * Drop least recently read images until the cache fits its budget. Run when a
 * bitmap lands, which is the only time the total grows.
 *
 * Two kinds of image are never dropped, so the budget is a target and a scene
 * showing more than it holds stays over: one a live renderer drew in its
 * latest frame, and one read since the previous pass. Without the first a
 * static canvas would lose what it is showing; without the second a reader
 * that never draws through GL would reload on every pass.
 */
function enforceBudget(landed: string): void {
  let total = 0;
  for (const entry of cache.values()) total += bytesOf(entry.bitmap);
  if (total > budgetBytes) {
    const idle = [...cache].filter(([src, entry]) =>
      src !== landed && entry.bitmap !== undefined && entry.readAt <= readsAtLastPass
      && !imageSourceInLatestFrame(entry.bitmap));
    idle.sort((a, b) => a[1].readAt - b[1].readAt);
    for (const [src, entry] of idle) {
      if (total <= budgetBytes) break;
      total -= bytesOf(entry.bitmap);
      releaseImage(src);
    }
  }
  readsAtLastPass = reads;
}

/**
 * Set how many bytes of decoded RGBA the cache may hold, and return the
 * previous value. Default 256MB; `Infinity` never drops anything. Takes
 * effect when the next image lands. A dropped image loads again on its next
 * {@link getImageBitmap}, as one never requested does.
 */
export function setImageCacheBudget(bytes: number): number {
  const previous = budgetBytes;
  budgetBytes = bytes;
  return previous;
}

function startLoad(src: string): void {
  const entry: Entry = { status: 'loading', readAt: ++reads };
  cache.set(src, entry);
  loader(src).then(
    (bitmap) => {
      // The entry may have been replaced/cleared mid-flight (reset, etc.);
      // only commit if this src is still the one we started loading.
      if (cache.get(src) !== entry) {
        dispose(bitmap);
        return;
      }
      cache.set(src, {
        status: 'ready',
        bitmap,
        readAt: entry.readAt,
        ...(isVectorImageSrc(src)
          ? { vector: { natural: { width: bitmap.width, height: bitmap.height }, scale: 1, failed: new Set<number>(), floor: 0 } }
          : {}),
      });
      enforceBudget(src);
      notify();
    },
    () => {
      // Cache the error so a broken `src` doesn't reload-storm.
      if (cache.get(src) !== entry) return;
      cache.set(src, { status: 'error', readAt: entry.readAt });
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
  const wanted = rasterScaleFor(v.natural, drawnAt);
  if (wanted === undefined) return;
  const grow = wanted > v.scale;
  if (grow && v.shrunkTo === v.scale) v.floor = Math.max(v.floor, wanted);
  const target = grow ? wanted : Math.max(wanted, v.floor);
  if (!grow && target * SHRINK_SLACK > v.scale) return;
  for (const f of v.failed) if (target === f || (grow && f > v.scale && target >= f)) return;

  v.pending = target;
  const size = {
    width: Math.max(1, Math.round(v.natural.width * target)),
    height: Math.max(1, Math.round(v.natural.height * target)),
  };
  loader(src, size).then(
    (bitmap) => {
      if (cache.get(src) !== entry) {
        dispose(bitmap);
        return;
      }
      v.pending = undefined;
      const old = entry.bitmap;
      entry.bitmap = bitmap;
      v.shrunkTo = grow ? undefined : target;
      v.scale = target;
      if (old && old !== bitmap) dispose(old);
      enforceBudget(src);
      notify();
    },
    () => {
      // The previous raster keeps painting; only this scale is given up on.
      if (cache.get(src) !== entry) return;
      v.pending = undefined;
      v.failed.add(target);
      // A reader waiting on a larger raster hears that none is coming.
      notify();
    },
  );
}

/** Synchronous read. Returns the decoded bitmap when ready; otherwise returns
 *  `undefined` and lazily starts a de-duped async load for `src`.
 *
 *  `drawnAt` is the size in device pixels the image is about to cover. A
 *  vector source ({@link isVectorImageSrc}) uses it to re-rasterize in
 *  power-of-two steps — the current raster is returned until the sharper one
 *  is ready. Raster sources ignore it.
 *
 *  The bitmap is valid until the cache drops it: when a load lands and it
 *  goes to fit the budget or gives way to a sharper raster, or on
 *  {@link releaseImage}. Read it again each frame rather than keep it; work
 *  holding it across an `await` takes a {@link holdImageBitmaps} hold. */
export function getImageBitmap(src: string, drawnAt?: ImageRasterSize): ImageBitmap | undefined {
  if (mintedHere(src)) return held.get(src)?.deref();
  const entry = cache.get(src);
  if (!entry) {
    startLoad(src);
    return undefined;
  }
  entry.readAt = ++reads;
  if (drawnAt && entry.vector) maybeReraster(src, entry, entry.vector, drawnAt);
  return entry.bitmap;
}

const BITMAP_SCHEME = 'weasel-bitmap:';
/** Names this realm mints carry its own token, so a page's and a worker's never collide. */
const REALM = Math.random().toString(36).slice(2, 10);
const mintedHere = (src: string): boolean => src.startsWith(`${BITMAP_SCHEME}${REALM}.`);

/** True when `src` is a {@link bitmapSrc} name, minted here or in another realm. */
export function isBitmapSrc(src: string): boolean {
  return src.startsWith(BITMAP_SCHEME);
}

/**
 * Hold `bitmap` under `src`, a {@link bitmapSrc} name another realm minted — the page that made
 * a bitmap, read from a render worker — as though it had loaded: drawn from the next frame on,
 * dropped to fit the budget like any load, and freed by {@link releaseImage}. The cache owns it
 * from here, so hand over a bitmap nothing else will close. A name another realm minted that
 * the cache does not hold goes to the loader (`setImageLoader`), which can answer the same way.
 */
export function adoptBitmapSrc(src: string, bitmap: ImageBitmap): void {
  if (mintedHere(src)) throw new Error(`weasel imageCache: ${src} was minted here; there is nothing to adopt`);
  const old = cache.get(src)?.bitmap;
  cache.set(src, { status: 'ready', bitmap, readAt: ++reads });
  if (old && old !== bitmap) dispose(old);
  enforceBudget(src);
  notify();
}
let held = new Map<string, WeakRef<ImageBitmap>>();
let srcOfBitmap = new WeakMap<ImageBitmap, string>();
let minted = 0;
const forget = new FinalizationRegistry<string>((src) => {
  if (held.get(src)?.deref() === undefined) held.delete(src);
});

/**
 * A `src` that names `bitmap` itself, for an image node to draw a bitmap made
 * at runtime — a canvas snapshot, a frame of video — with no load. The same
 * bitmap always gets the same `src`, so a node handed it again changes no
 * data and its texture is not uploaded again. A bitmap is immutable, so that
 * identity is its content: new pixels are a new bitmap and a new `src`.
 *
 * The cache holds the bitmap weakly and never drops it to fit its budget;
 * whoever made it keeps it alive while it is drawn. {@link releaseImage}
 * frees its textures at once and retires the name, which never loads.
 */
export function bitmapSrc(bitmap: ImageBitmap): string {
  let src = srcOfBitmap.get(bitmap);
  if (src === undefined) {
    src = `${BITMAP_SCHEME}${REALM}.${++minted}`;
    srcOfBitmap.set(bitmap, src);
    held.set(src, new WeakRef(bitmap));
    forget.register(bitmap, src, bitmap);
  }
  return src;
}

/** The size `src` decoded at before any re-rasterizing, once it has: a
 *  vector source's raster changes with the size it is drawn at, and this
 *  does not. `undefined` while it loads or after it failed.
 *  @internal */
export function imageNaturalSize(src: string): ImageRasterSize | undefined {
  const entry = cache.get(src);
  if (entry?.vector) return entry.vector.natural;
  const bitmap = entry?.bitmap ?? held.get(src)?.deref();
  return bitmap ? { width: bitmap.width, height: bitmap.height } : undefined;
}

/** Whether a load of `src`, or a re-raster of a vector source at another size, is in flight:
 *  whether {@link subscribeImageReady} will hear of a new bitmap for it. */
export function imagePending(src: string): boolean {
  const entry = cache.get(src);
  return entry?.status === 'loading' || entry?.vector?.pending !== undefined;
}

/** Current load status for `src` (`'idle'` if never requested). */
export function imageStatus(src: string): ImageStatus {
  if (mintedHere(src)) return getImageBitmap(src) === undefined ? 'idle' : 'ready';
  return cache.get(src)?.status ?? 'idle';
}

/**
 * Forget `src`: close its decoded bitmap, drop its decoded SVG and the texture every
 * live renderer holds for it, and abandon a load in flight. The cache is keyed
 * by `src` across every scene on the page, so it cannot know when the last use
 * is gone; whoever does know calls this. A later {@link getImageBitmap} for the
 * same `src` loads it again.
 */
export function releaseImage(src: string): void {
  const bitmap = held.get(src)?.deref();
  held.delete(src);
  if (bitmap !== undefined) {
    srcOfBitmap.delete(bitmap);
    forget.unregister(bitmap);
    releaseImageSource(bitmap);
  }
  const entry = cache.get(src);
  cache.delete(src);
  forgetDecodedVector(src);
  if (entry?.bitmap) dispose(entry.bitmap);
}

/** Load a `src` whose last load failed again. Does nothing for a `src` in any
 *  other state; one that failed otherwise stays `'error'` for the page's life. */
export function retryImage(src: string): void {
  if (cache.get(src)?.status !== 'error') return;
  startLoad(src);
  notify();
}

/** Subscribe to load-resolution events (fires after any `src` resolves or
 *  errors). Returns an unsubscribe. */
export function subscribeImageReady(cb: () => void): () => void {
  return ready.subscribe(cb);
}

/** @internal test seam — override the async loader so unit tests don't need
 *  a real DOM image. Not part of the public barrel. */
export function __setImageLoaderForTests(fn: ImageLoader): void {
  loader = fn;
}

/** @internal test seam — clear cache + subscribers and restore the default
 *  loader. Not part of the public barrel. */
export function _resetImageCacheForTests(): void {
  cache.clear();
  held = new Map();
  srcOfBitmap = new WeakMap();
  ready = createEmitter();
  forgetDecodedVector();
  loader = loadImageBitmap;
  budgetBytes = DEFAULT_BUDGET_BYTES;
  reads = 0;
  readsAtLastPass = 0;
  holds = 0;
  closeLater = new Set();
}
