import { releaseImage } from '@weasel-js/core';
import { useEffect, useRef } from 'react';

type WithImage = { data?: unknown };

/** The image sources `specs` draw. */
export function imageSrcsOf(specs: readonly WithImage[]): Set<string> {
  const out = new Set<string>();
  for (const s of specs) {
    const src = (s.data as { image?: { src?: unknown } } | undefined)?.image?.src;
    if (typeof src === 'string') out.add(src);
  }
  return out;
}

/**
 * Frees each image a change of `specs` stops drawing, and every one it draws on unmount. The image
 * cache only drops bitmaps once their bytes pass its budget, and never counts the decoded source or
 * its key, so a view whose images change often — a new data URL per edit — would otherwise keep
 * every one it has shown until then. One still drawn elsewhere loads again on its next draw.
 */
export function useReleasedImages(specs: readonly WithImage[]): void {
  const held = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const now = imageSrcsOf(specs);
    for (const src of held.current) if (!now.has(src)) releaseImage(src);
    held.current = now;
  }, [specs]);
  useEffect(() => () => {
    for (const src of held.current) releaseImage(src);
    held.current = new Set();
  }, []);
}
