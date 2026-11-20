/**
 * Images across the worker boundary. A worker decodes a raster itself, off the page's thread.
 * Two kinds of source only the page can serve: an SVG, which needs an `<img>` to rasterize from,
 * and a `bitmapSrc` name, whose bitmap the page made. For those the worker asks the page, which
 * answers from its own image cache with a copy it transfers.
 */
import {
  getImageBitmap, imagePending, imageStatus, isBitmapSrc, isVectorImageSrc, loadImageBitmap, setImageLoader, subscribeImageReady,
  type ImageLoader, type ImageRasterSize,
} from '@weasel-js/renderer';
import type { FromWorker, ToWorker } from './protocol';

type Waiter = { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void };
type Ask = (src: string, size: ImageRasterSize | undefined) => Promise<ImageBitmap>;

/** Every page this realm's hosts serve, oldest first. The image cache is the realm's, so a load
 *  asks each page in turn until one answers: a `bitmapSrc` name is only the page that minted it's. */
const pages: Ask[] = [];

const loadFromPages: ImageLoader = async (src, size) => {
  if (!isVectorImageSrc(src) && !isBitmapSrc(src)) return loadImageBitmap(src, size);
  let failure: unknown = new Error(`weasel render worker: no page to load ${src} from`);
  for (const ask of [...pages]) {
    try {
      return await ask(src, size);
    } catch (e) {
      failure = e;
    }
  }
  throw failure;
};

/** What the page behind one host serves of the worker's loads. */
export interface PageImages {
  /** Hand the page's answer to the request it answers. */
  answer(answer: Extract<ToWorker, { type: 'image' }>): void;
  /** Stop asking this page: what still waits on it is asked of the next. */
  dispose(): void;
}

/** Route the worker's loads of what only the page can serve through `ask`, beside any other
 *  host's page in this realm. Each request carries an id its answer echoes: the page answers a
 *  request for a sharper raster only once that raster lands, so answers come out of order. */
export function loadFromPage(ask: (request: Extract<FromWorker, { type: 'image' }>) => void): PageImages {
  const waiting = new Map<number, Waiter>();
  let next = 0;
  const askPage: Ask = (src, size) => new Promise<ImageBitmap>((resolve, reject) => {
    const id = ++next;
    waiting.set(id, { resolve, reject });
    ask(size ? { type: 'image', id, src, size } : { type: 'image', id, src });
  });
  pages.push(askPage);
  if (pages.length === 1) setImageLoader(loadFromPages);
  return {
    answer(answer) {
      const waiter = waiting.get(answer.id);
      if (!waiter) return;
      waiting.delete(answer.id);
      if (answer.bitmap) waiter.resolve(answer.bitmap);
      else waiter.reject(new Error(answer.error ?? `weasel render worker: the page could not load ${answer.src}`));
    },
    dispose() {
      const at = pages.indexOf(askPage);
      if (at < 0) return;
      pages.splice(at, 1);
      if (pages.length === 0) setImageLoader(null);
      for (const w of waiting.values()) w.reject(new Error('weasel render worker: the page closed'));
      waiting.clear();
    },
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
  let landings = 0;
  let seen: ImageBitmap | undefined;
  let first = true;
  const attempt = (): boolean => {
    const bitmap = getImageBitmap(src, size);
    // The ready notice is the page's, for any source: only a new raster of this one is a landing.
    if (!first && bitmap !== seen) landings++;
    first = false;
    seen = bitmap;
    const bigEnough = !size || (bitmap && bitmap.width >= size.width && bitmap.height >= size.height);
    // A raster smaller than asked for waits for one re-raster landing, no longer, and for none when
    // the page starts none: its texture side may be smaller than the worker's.
    if (bitmap && (bigEnough || landings > 0 || !imagePending(src))) {
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
    return false;
  };
  if (attempt()) return () => {};
  const off = subscribeImageReady(() => { if (attempt()) off(); });
  return off;
}
