/**
 * Names for bitmaps made at runtime, which an image node draws through the image cache with no
 * load. The names live here; the cache asks whether a `src` is one and which bitmap it names.
 */

const BITMAP_SCHEME = 'weasel-bitmap:';
/** Names this realm mints carry its own token, so a page's and a worker's never collide. */
const REALM = Math.random().toString(36).slice(2, 10);

let held = new Map<string, WeakRef<ImageBitmap>>();
let srcOfBitmap = new WeakMap<ImageBitmap, string>();
let minted = 0;
const forget = new FinalizationRegistry<string>((src) => {
  if (held.get(src)?.deref() === undefined) held.delete(src);
});

/** Whether this realm minted `src`. */
export const mintedHere = (src: string): boolean => src.startsWith(`${BITMAP_SCHEME}${REALM}.`);

/** True when `src` is a {@link bitmapSrc} name, minted here or in another realm. */
export function isBitmapSrc(src: string): boolean {
  return src.startsWith(BITMAP_SCHEME);
}

/**
 * A `src` that names `bitmap` itself, for an image node to draw a bitmap made
 * at runtime — a canvas snapshot, a frame of video — with no load. The same
 * bitmap always gets the same `src`, so a node handed it again changes no
 * data and its texture is not uploaded again. A bitmap is immutable, so that
 * identity is its content: new pixels are a new bitmap and a new `src`.
 *
 * The cache holds the bitmap weakly and never drops it to fit its budget;
 * whoever made it keeps it alive while it is drawn. `releaseImage`
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

/** The bitmap a name minted here holds, while it is alive and the name is not retired. */
export function namedBitmap(src: string): ImageBitmap | undefined {
  return held.get(src)?.deref();
}

/** Retire `src`, and return the bitmap it named, if it still did. */
export function retireBitmapName(src: string): ImageBitmap | undefined {
  const bitmap = held.get(src)?.deref();
  held.delete(src);
  if (bitmap !== undefined) {
    srcOfBitmap.delete(bitmap);
    forget.unregister(bitmap);
  }
  return bitmap;
}

/** @internal test seam. */
export function _resetBitmapNamesForTests(): void {
  held = new Map();
  srcOfBitmap = new WeakMap();
}
