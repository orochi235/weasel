import { useLayoutEffect, useState, type RefObject } from 'react';

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
    const update = () => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [ref, when]);

  return box;
}
