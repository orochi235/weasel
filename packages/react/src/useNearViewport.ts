import { type RefObject, useEffect, useState } from 'react';

/**
 * Whether `ref`'s element lies within `margin` (a CSS `rootMargin`) of its document's viewport; true where the
 * browser cannot say. It follows the element both ways: it turns false again once the element moves away.
 * Decided by where the element is, not by whether any of it shows: `isIntersecting` is false too for an element an
 * `overflow` ancestor clips away, as a narrow tile does to its content while the tiling changes. `initial` is
 * the answer before the browser has given one: false for content too costly to mount everywhere at once.
 */
export function useNearViewport(ref: RefObject<Element | null>, margin: string, initial = true): boolean {
  const [near, setNear] = useState(() => initial || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    // A fresh observe always reports, wherever the element is.
    const recheck = () => {
      observer.unobserve(el);
      observer.observe(el);
    };
    let watching = false;
    const watch = (on: boolean) => {
      if (on === watching) return;
      watching = on;
      if (on) {
        doc.addEventListener('scroll', recheck, { capture: true, passive: true });
        win?.addEventListener('resize', recheck);
      } else {
        doc.removeEventListener('scroll', recheck, { capture: true });
        win?.removeEventListener('resize', recheck);
      }
    };
    // Entries queued before `disconnect()` still arrive, and would re-add the scroll listener and wake the observer.
    let live = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries.at(-1);
        if (!last || !live) return;
        const root = last.rootBounds;
        const box = last.boundingClientRect;
        setNear(
          root
            ? box.bottom >= root.top && box.top <= root.bottom && box.right >= root.left && box.left <= root.right
            : last.isIntersecting,
        );
        // While nothing of it intersects, a clip can hide every move from the observer, so ask again on each scroll.
        watch(Boolean(root) && !last.isIntersecting);
      },
      { root: doc, rootMargin: margin },
    );
    observer.observe(el);
    return () => {
      live = false;
      observer.disconnect();
      watch(false);
    };
  }, [ref, margin]);
  return near;
}
