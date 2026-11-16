import { useLayoutEffect, useState, type RefObject } from 'react';
import { watchResize } from '@weasel-js/react';

/**
 * Live CSS-pixel size of the SVG `ref`'s element belongs to; an outermost `<svg>` is its own.
 * `when` both gates the measurement and re-measures whenever its identity changes.
 */
export function useSvgBox(ref: RefObject<SVGElement | null>, when: unknown = true): { w: number; h: number } {
  const [box, setBox] = useState({ w: 100, h: 100 });

  useLayoutEffect(() => {
    const el = when ? ref.current : null;
    const svg = el?.ownerSVGElement ?? el;
    if (!svg) return;
    const set = (w: number, h: number) => {
      if (w > 0 && h > 0) setBox((was) => (was.w === w && was.h === h ? was : { w, h }));
    };
    const r = svg.getBoundingClientRect();
    set(r.width, r.height);
    // The observer's size is the layout's own, where a bounding rect is scaled by any transform.
    return watchResize(svg, ([entry]) => {
      const size = entry?.borderBoxSize?.[0];
      if (size) set(size.inlineSize, size.blockSize);
    });
  }, [ref, when]);

  return box;
}
