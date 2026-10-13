import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import type { ShapeInsets } from './types';
import type { BaseModule } from './bases/types';
import { clearRect, fitInsets } from './bases/inscribedRect';

const NONE: ShapeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

interface InsetSource<P> {
  insets?: ShapeInsets | ((params: P) => ShapeInsets);
  fitsContent?: boolean;
  build?: BaseModule<P>['build'];
}

/** `ref`'s layout size in CSS px, or null until it has one. */
function useElementSize(ref: RefObject<HTMLElement | null>, enabled: boolean): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = enabled ? ref.current : null;
    if (!el) return;
    const set = (w: number, h: number) => {
      if (w > 0 && h > 0) setSize((was) => (was && was.w === w && was.h === h ? was : { w, h }));
    };
    const r = el.getBoundingClientRect();
    set(r.width, r.height);
    if (typeof ResizeObserver === 'undefined') return;
    // The observer's size is the layout's own, where a bounding rect is scaled by any transform.
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      if (box) set(box.inlineSize, box.blockSize);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, enabled]);
  return enabled ? size : null;
}

/**
 * The padding a shape or base adds around the badge's content. A base that `fitsContent` has
 * an outline that dips inside its box by a share of the box, so its declared `insets`
 * grow by whatever share of the content at `contentRef` keeps that content inside the outline.
 */
export function useInsets<P>(source: InsetSource<P>, params: P, contentRef: RefObject<HTMLElement | null>): ShapeInsets {
  const fits = source.fitsContent === true && source.build !== undefined;
  const size = useElementSize(contentRef, fits);
  const key = fits ? JSON.stringify(params) : '';
  const rect = useMemo(
    () => (fits ? clearRect(source.build!(params, 100, 100)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `params` is a fresh object every render; `key` is its value.
    [fits, source, key],
  );
  const declared = (typeof source.insets === 'function' ? source.insets(params) : source.insets) ?? NONE;
  return rect && size ? fitInsets(rect, size, declared) : declared;
}
