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

/** Public shape of an image node's `data`. `src` round-trips through
 *  serialization; the decoded bitmap is held in this cache, not on the node. */
export interface ImageNodeData {
  image: { src: string; opacity?: number };
}

/** Where an image is in its load: never requested, in flight, decoded, or
 *  failed. Renderers paint a placeholder for anything but `'ready'`. */
export type ImageStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Entry {
  status: ImageStatus;
  bitmap?: ImageBitmap;
}

type Loader = (src: string) => Promise<ImageBitmap>;

const cache = new Map<string, Entry>();
const subscribers = new Set<() => void>();

const defaultLoader: Loader = async (src) => {
  if (typeof Image === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('weasel imageCache: no DOM image loader in this environment');
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  return createImageBitmap(img);
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
      cache.set(src, { status: 'ready', bitmap });
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

/** Synchronous read. Returns the decoded bitmap when ready; otherwise returns
 *  `undefined` and lazily starts a de-duped async load for `src`. */
export function getImageBitmap(src: string): ImageBitmap | undefined {
  const entry = cache.get(src);
  if (entry) return entry.bitmap;
  startLoad(src);
  return undefined;
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
  loader = defaultLoader;
}
