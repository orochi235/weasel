import { useCallback, useEffect, useState } from 'react';
import { useLatest, useVisibleRaf, watchElementMove, watchResize } from '@weasel-js/react';
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
 * viewport, following it through scrolls, resizes, and reflows, a host moved by
 * its neighbors included.
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
  const [host, setHost] = useState<Element | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setPanel(el), []);

  // Held in a ref so a caller passing an inline arrow doesn't re-subscribe
  // every render.
  const resolve = useLatest(resolveHost);

  const { align, offset, padding = 0 } = options;
  const { x: alignX, y: alignY } = align;
  const { x: offsetX, y: offsetY } = offset;

  const recompute = useCallback(() => {
    const hostEl = resolve.current();
    setHost(hostEl);
    if (!hostEl) {
      setStyle(null);
      return;
    }
    const h = hostEl.getBoundingClientRect();
    const p = panel?.getBoundingClientRect();
    const viewport = layoutViewport();
    const align = { x: alignX, y: alignY };
    const rect = hostAnchorRect({
      host: { x: h.left, y: h.top, width: h.width, height: h.height },
      panel: { width: p?.width ?? 0, height: p?.height ?? 0 },
      viewport,
      align,
      offset: { x: offsetX, y: offsetY },
      padding,
    });
    setStyle(hostAnchorCss(rect, align, viewport));
  }, [resolve, panel, alignX, alignY, offsetX, offsetY, padding]);

  // Coalesces bursts of scroll/resize into one frame, and holds the work while
  // the tab is hidden rather than dropping it.
  const raf = useVisibleRaf(recompute);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measures layout
    recompute();
    const schedule = () => raf.request();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      raf.cancel();
    };
  }, [recompute, raf]);

  // The host the last recompute found is the one watched, so a host that
  // appears, or a selector that starts naming another element, moves the watch.
  useEffect(() => {
    const schedule = () => raf.request();
    const unwatchResize = watchResize([panel, host], schedule);
    if (host) {
      const unwatchMove = watchElementMove(host, schedule);
      return () => { unwatchResize(); unwatchMove(); };
    }
    // Nothing else says when an unresolved host mounts.
    const mounts = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);
    mounts?.observe(document, { childList: true, subtree: true, attributes: true });
    return () => { unwatchResize(); mounts?.disconnect(); };
  }, [panel, host, raf]);

  return { ref, style };
}

/** The box a fixed-position element's edges are measured from: the window less its scrollbars. Falls back
 *  to the window where the document reports no size, as an unrendered one does. */
function layoutViewport(): { width: number; height: number } {
  const root = document.documentElement;
  return { width: root.clientWidth || window.innerWidth, height: root.clientHeight || window.innerHeight };
}
