import { releaseImageSource } from '../cache/GLImageCache';

/** Open {@link holdImageBitmaps} holds, and the bitmaps dropped while one is open. */
let holds = 0;
let closeLater = new Set<ImageBitmap>();

/**
 * Free `bitmap`'s textures and close it, for an owner dropping it: the image
 * cache owns every bitmap it loads or adopts. While a
 * {@link holdImageBitmaps} hold is open the close waits.
 */
export function closeDropped(bitmap: ImageBitmap): void {
  releaseImageSource(bitmap);
  if (holds > 0) closeLater.add(bitmap);
  else bitmap.close();
}

/** `bitmap` is owned again, so a close a hold deferred must not reach it. */
export function reclaimed(bitmap: ImageBitmap): void {
  closeLater.delete(bitmap);
}

/**
 * Keep every bitmap the image cache drops open until the returned release is
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
    for (const bitmap of pending) bitmap.close();
  };
}

/** @internal test seam. */
export function _resetBitmapHoldsForTests(): void {
  holds = 0;
  closeLater = new Set();
}
