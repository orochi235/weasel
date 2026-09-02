import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hostAnchorCss, hostAnchorRect,
  type HostAnchorAlign, type HostAnchorOffset,
} from './hostAnchor';

/** Options for {@link useHostAnchor}. */
export interface UseHostAnchorOptions {
  align: HostAnchorAlign;
  offset: HostAnchorOffset;
  /** Minimum gap kept between the panel and the viewport edge. Default 0. */
  padding?: number;
}

/** CSS the caller spreads onto the panel; which edges appear follows `align`. */
export type HostAnchorStyle = { top?: number; right?: number; bottom?: number; left?: number };

/**
 * Hold a fixed-position panel against a host element's corner, kept inside the
 * viewport, following it through scrolls, resizes and reflows.
 *
 * `resolveHost` runs on every recompute, so a host that mounts late or is found
 * by selector works the same as one held in a ref. Put the returned `ref` on the
 * panel: until it is measured the panel counts as zero-sized, which resolves to
 * the bare corner, so the first paint lands where an unclamped anchor would and
 * measurement only ever pulls it back on screen.
 */
export function useHostAnchor(
  resolveHost: () => Element | null,
  options: UseHostAnchorOptions,
): { ref: (el: HTMLElement | null) => void; style: HostAnchorStyle | null } {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [style, setStyle] = useState<HostAnchorStyle | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setPanel(el), []);

  // Held in a ref so a caller passing an inline arrow doesn't re-subscribe
  // every render.
  const resolve = useRef(resolveHost);
  resolve.current = resolveHost;

  const { align, offset, padding = 0 } = options;
  const { x: alignX, y: alignY } = align;
  const { x: offsetX, y: offsetY } = offset;

  useEffect(() => {
    let frame = 0;
    const recompute = () => {
      frame = 0;
      const hostEl = resolve.current();
      if (!hostEl) {
        setStyle(null);
        return;
      }
      const h = hostEl.getBoundingClientRect();
      const p = panel?.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const resolvedAlign = { x: alignX, y: alignY };
      const rect = hostAnchorRect({
        host: { x: h.left, y: h.top, width: h.width, height: h.height },
        panel: { width: p?.width ?? 0, height: p?.height ?? 0 },
        viewport,
        align: resolvedAlign,
        offset: { x: offsetX, y: offsetY },
        padding,
      });
      setStyle(hostAnchorCss(rect, resolvedAlign, viewport));
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(recompute);
    };

    recompute();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (panel) observer?.observe(panel);
    const hostEl = resolve.current();
    if (hostEl) observer?.observe(hostEl);

    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [panel, alignX, alignY, offsetX, offsetY, padding]);

  return { ref, style };
}
