/**
 * Images across the worker boundary. A worker decodes a raster itself, off the page's thread.
 * Two kinds of source only the page can serve: an SVG, which needs an `<img>` to rasterize from,
 * and a `bitmapSrc` name, whose bitmap the page made. For those the worker asks the page, which
 * answers from its own image cache with a copy it transfers.
 */
import {
  getImageBitmap, imageStatus, isBitmapSrc, isVectorImageSrc, loadImageBitmap, setImageLoader, subscribeImageReady,
  type ImageRasterSize,
} from '@weasel-js/renderer';
import type { FromWorker, ToWorker } from './protocol';

type Waiter = { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void };

/** Route the worker's loads of what only the page can serve through `ask`. Returns the handler
 *  for the page's answers. */
export function loadFromPage(ask: (src: string, size?: ImageRasterSize) => void): (
  answer: Extract<ToWorker, { type: 'image' }>,
) => void {
  const waiting = new Map<string, Waiter[]>();
  setImageLoader((src, size) => {
    if (!isVectorImageSrc(src) && !isBitmapSrc(src)) return loadImageBitmap(src, size);
    return new Promise<ImageBitmap>((resolve, reject) => {
      const list = waiting.get(src) ?? [];
      list.push({ resolve, reject });
      waiting.set(src, list);
      ask(src, size);
    });
  });
  return (answer) => {
    const list = waiting.get(answer.src);
    const waiter = list?.shift();
    if (list?.length === 0) waiting.delete(answer.src);
    if (!waiter) return;
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
  const { src, size } = request;
  let tries = 0;
  const attempt = (): boolean => {
    const bitmap = getImageBitmap(src, size);
    const bigEnough = !size || (bitmap && bitmap.width >= size.width && bitmap.height >= size.height);
    // A raster smaller than asked for is a re-raster in flight: wait for one landing, no longer.
    if (bitmap && (bigEnough || tries > 0)) {
      // A copy, so the page's own stays whole and the worker's cache can own the one it gets.
      createImageBitmap(bitmap).then(
        (copy) => reply({ type: 'image', src, bitmap: copy }),
        (e: unknown) => reply({ type: 'image', src, error: String(e) }),
      );
      return true;
    }
    // A name the page minted and has let go of never loads again.
    const status = imageStatus(src);
    if (status === 'error' || (!bitmap && isBitmapSrc(src) && status === 'idle')) {
      reply({ type: 'image', src, error: `weasel: could not load ${src}` });
      return true;
    }
    tries++;
    return false;
  };
  if (attempt()) return () => {};
  const off = subscribeImageReady(() => { if (attempt()) off(); });
  return off;
}
