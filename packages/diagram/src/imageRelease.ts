import { imageStatus, releaseImage, subscribeImageReady } from '@weasel-js/core';
import { useEffect, useMemo, useRef } from 'react';
import { useReleaseOnUnmount } from './releaseOnUnmount';

type Image = { src: string; previous?: string };
type WithImage = { id?: unknown; data?: unknown };

const imageOf = (s: WithImage): Image | undefined => {
  const image = (s.data as { image?: { src?: unknown; previous?: unknown } } | undefined)?.image;
  return typeof image?.src === 'string' ? image as Image : undefined;
};

/**
 * `specs`, each image whose `src` differs from the one `before` gave its id carrying the last
 * picture that node had decoded as `previous`, which the image painter draws until the new one
 * decodes. A node that has never decoded one carries none.
 */
export function withPreviousImages<T extends WithImage>(specs: readonly T[], before: ReadonlyMap<unknown, Image>): T[] {
  return specs.map((s) => {
    const image = imageOf(s);
    const was = image === undefined ? undefined : before.get(s.id);
    if (image === undefined || was === undefined) return s;
    const previous = was.src === image.src ? was.previous : imageStatus(was.src) === 'ready' ? was.src : was.previous;
    if (previous === undefined || previous === image.previous) return s;
    return { ...s, data: { ...(s.data as object), image: { ...image, previous } } };
  });
}

/** The images `specs` still need: every `src`, and a `previous` standing in for one still on its way.
 *  Once `src` fails the painter draws the failure, not `previous`. */
export function imagesNeeded(specs: readonly WithImage[]): Set<string> {
  const out = new Set<string>();
  for (const s of specs) {
    const image = imageOf(s);
    if (image === undefined) continue;
    out.add(image.src);
    if (image.previous === undefined) continue;
    const status = imageStatus(image.src);
    if (status === 'idle' || status === 'loading') out.add(image.previous);
  }
  return out;
}

/** `specs` with each swapped picture held over until its replacement decodes ({@link withPreviousImages}). */
export function useHeldImages<T extends WithImage>(specs: readonly T[]): T[] {
  const last = useRef<ReadonlyMap<unknown, Image>>(new Map());
  const out = useMemo(() => withPreviousImages(specs, last.current), [specs]);
  useEffect(() => {
    last.current = new Map(out.flatMap((s) => {
      const image = imageOf(s);
      return image === undefined ? [] : [[s.id, image] as const];
    }));
  }, [out]);
  return out;
}

/**
 * Frees each image `specs` stop needing — one no longer drawn, or a held-over picture once its
 * replacement has decoded — and every one they need on unmount. The image cache only drops
 * bitmaps once their bytes pass its budget, and never counts the decoded source or its key, so a
 * view whose images change often would otherwise keep every one it has shown until then. One
 * still drawn elsewhere loads again on its next draw.
 */
export function useReleasedImages(specs: readonly WithImage[]): void {
  const held = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const settle = () => {
      const now = imagesNeeded(specs);
      for (const src of held.current) if (!now.has(src)) releaseImage(src);
      held.current = now;
    };
    settle();
    return subscribeImageReady(settle);
  }, [specs]);
  useReleaseOnUnmount(held, releaseImage);
}
