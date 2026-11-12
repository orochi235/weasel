/**
 * Images across the worker boundary. A worker decodes a raster itself, off the page's thread.
 * Two kinds of source only the page can serve: an SVG, which needs an `<img>` to rasterize from,
 * and a `bitmapSrc` name, whose bitmap the page made. For those the worker asks the page, which
 * answers from its own image cache with a copy it transfers.
 */
import {
  getImageBitmap, imagePending, imageStatus, isBitmapSrc, isVectorImageSrc, loadImageBitmap, setImageLoader, subscribeImageReady,
} from '@weasel-js/renderer';
import type { FromWorker, ToWorker } from './protocol';

type Waiter = { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void };

/** Route the worker's loads of what only the page can serve through `ask`. Returns the handler
 *  for the page's answers. Each request carries an id its answer echoes: the page answers a
 *  request for a sharper raster only once that raster lands, so answers come out of order. */
export function loadFromPage(ask: (request: Extract<FromWorker, { type: 'image' }>) => void): (
  answer: Extract<ToWorker, { type: 'image' }>,
) => void {
  const waiting = new Map<number, Waiter>();
  let next = 0;
  setImageLoader((src, size) => {
    if (!isVectorImageSrc(src) && !isBitmapSrc(src)) return loadImageBitmap(src, size);
    return new Promise<ImageBitmap>((resolve, reject) => {
      const id = ++next;
      waiting.set(id, { resolve, reject });
      ask(size ? { type: 'image', id, src, size } : { type: 'image', id, src });
    });
  });
  return (answer) => {
    const waiter = waiting.get(answer.id);
    if (!waiter) return;
    waiting.delete(answer.id);
    if (answer.bitmap) waiter.resolve(answer.bitmap);
    else waiter.reject(new Error(answer.error ?? `weasel render worker: the page could not load ${answer.src}`));
  };
}

/**
 * Answer a worker's request for `src` from the page's image cache, once it holds a raster at
 * least `size` large or has finished trying. Returns a function that stops waiting.
 */
export function answerImage(
  request: Extract<FromWorker, { type: 'image' }>,
  reply: (answer: Extract<ToWorker, { type: 'image' }>) => void,
): () => void {
  const { id, src, size } = request;
  let tries = 0;
  const attempt = (): boolean => {
    const bitmap = getImageBitmap(src, size);
    const bigEnough = !size || (bitmap && bitmap.width >= size.width && bitmap.height >= size.height);
    // A raster smaller than asked for waits for one re-raster landing, no longer, and for none when
    // the page starts none: its texture side may be smaller than the worker's.
    if (bitmap && (bigEnough || tries > 0 || !imagePending(src))) {
      // A copy, so the page's own stays whole and the worker's cache can own the one it gets.
      createImageBitmap(bitmap).then(
        (copy) => reply({ type: 'image', id, src, bitmap: copy }),
        (e: unknown) => reply({ type: 'image', id, src, error: String(e) }),
      );
      return true;
    }
    // A name the page minted and has let go of never loads again.
    const status = imageStatus(src);
    if (status === 'error' || (!bitmap && isBitmapSrc(src) && status === 'idle')) {
      reply({ type: 'image', id, src, error: `weasel: could not load ${src}` });
      return true;
    }
    tries++;
    return false;
  };
  if (attempt()) return () => {};
  const off = subscribeImageReady(() => { if (attempt()) off(); });
  return off;
}
