/**
 * Images across the worker boundary. A worker decodes a raster itself, off the page's thread;
 * an SVG needs an `<img>` to rasterize from, which only the page has, so the worker asks the page
 * and the page answers from its own image cache.
 */
import {
  getImageBitmap, imageStatus, isVectorImageSrc, loadImageBitmap, setImageLoader, subscribeImageReady,
  type ImageRasterSize,
} from '@weasel-js/renderer';
import type { FromWorker, ToWorker } from './protocol';

type Waiter = { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void };

/** Route the worker's vector loads to the page through `ask`. Returns the handler for the
 *  page's answers. */
export function loadVectorsFromPage(ask: (src: string, size?: ImageRasterSize) => void): (
  answer: Extract<ToWorker, { type: 'image' }>,
) => void {
  const waiting = new Map<string, Waiter[]>();
  setImageLoader((src, size) => {
    if (!isVectorImageSrc(src)) return loadImageBitmap(src, size);
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
      reply({ type: 'image', src, bitmap });
      return true;
    }
    if (imageStatus(src) === 'error') {
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
