import { type RefObject, useEffect, useState } from 'react';

/** How far past the viewport a trial's story stays mounted, so a small scroll back does not reload it. */
export const IN_VIEW_MARGIN = '50%';

/**
 * Whether `ref`'s element lies within `margin` of its document's viewport; true where the browser cannot say.
 * Decided by where the element is, not by whether any of it shows: `isIntersecting` is false too for an element an
 * `overflow` ancestor clips away, as a narrow lab tile does to its content while the tiling changes.
 */
export function useNearViewport(ref: RefObject<Element | null>, margin: string): boolean {
  const [near, setNear] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries.at(-1);
        if (!last) return;
        const root = last.rootBounds;
        const box = last.boundingClientRect;
        setNear(
          root
            ? box.bottom >= root.top && box.top <= root.bottom && box.right >= root.left && box.left <= root.right
            : last.isIntersecting,
        );
      },
      { root: document, rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin]);
  return near;
}
