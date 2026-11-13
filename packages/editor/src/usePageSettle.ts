import {
  fitViewToPage, pageHolding, pageInView, useLatest, viewportWorldRect, type PlacedPage, type View,
} from '@weasel-js/core';
import { useEffect, useRef, useState } from 'react';

/** How the view moves through a document's pages: freely (`'continuous'`, the default), or coming to rest
 *  fitted to one page at a time (`'single'`). A view setting; the same document opens in either. */
export type Paging = 'continuous' | 'single';

/** Where a view goes: a setter, or a view dep that may animate there (`ViewApi`'s `set` and `animate`). */
export type ViewSink = ((view: View) => void) | { set(view: View): void; animate?(to: View): void };

/** How long the view has to sit still before it settles, in ms. */
export const PAGE_SETTLE_MS = 150;

/** Send `view` to `sink`, animated when it can. */
export function sendView(sink: ViewSink, view: View): void {
  if (typeof sink === 'function') sink(view);
  else if (sink.animate) sink.animate(view);
  else sink.set(view);
}

/** How far past a page's fit the view may be zoomed and still settle, as a fraction of the fit scale. */
const ZOOM_TOLERANCE = 0.01;

function near(a: View, b: View): boolean {
  const px = 0.5 / Math.max(a.scale.x, a.scale.y);
  return Math.abs(a.x - b.x) < px && Math.abs(a.y - b.y) < px
    && Math.abs(a.scale.x / b.scale.x - 1) < 1e-3 && Math.abs(a.scale.y / b.scale.y - 1) < 1e-3;
}

/** Whether any pointer is down in the window, counted by `pointerId` so a pinch stays down while one
 *  finger is. A window blur clears them, since their releases may never arrive. */
function usePointerDown(on: boolean): boolean {
  const [down, setDown] = useState(false);
  useEffect(() => {
    if (!on) return;
    const held = new Set<number>();
    const press = (e: PointerEvent) => { held.add(e.pointerId); setDown(true); };
    const release = (e: PointerEvent) => { held.delete(e.pointerId); setDown(held.size > 0); };
    const clear = () => { held.clear(); setDown(false); };
    window.addEventListener('pointerdown', press, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('pointerdown', press, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', clear);
      setDown(false);
    };
  }, [on]);
  return down;
}

/** Options for {@link usePageSettle}. */
export interface PageSettleOptions {
  /** `'single'` settles the view onto one page; `'continuous'` leaves it alone. */
  paging: Paging;
  /** What the fit leaves around the page, in screen pixels. Default 24. */
  padding?: number;
}

/**
 * With `'single'` paging, brings the view to rest fitted to one page: `PAGE_SETTLE_MS` after the view last
 * moved, and never while a pointer is down, it goes to the page the view shows most of, or with none
 * showing the nearest. A view zoomed in past that page's fit is left where it is, to pan freely, unless it
 * was fitted to that page before the host's size changed, when it is fitted again. Animated when `setView`
 * is a view dep with `animate`. With `'continuous'` it does nothing.
 */
export function usePageSettle(
  pages: { readonly placed: readonly PlacedPage[] },
  view: View,
  dims: { width: number; height: number },
  setView: ViewSink,
  { paging, padding = 24 }: PageSettleOptions,
): void {
  const single = paging === 'single';
  const down = usePointerDown(single);
  const latest = useLatest({ placed: pages.placed, view, dims, setView });
  // The host size the view was last fitted at, while it stays fitted.
  const fittedAt = useRef<{ width: number; height: number } | null>(null);
  const ready = single && !down && dims.width > 0 && dims.height > 0 && pages.placed.length > 0;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const { placed, view: v, dims: d, setView: sink } = latest.current;
      const page = pageInView(placed, v, d) ?? pageHolding(placed, viewportWorldRect(v, d));
      if (!page) return;
      const to = fitViewToPage(page, d, v, { padding });
      if (!to) return;
      const was = fittedAt.current;
      const wasFit = was === null ? null : fitViewToPage(page, was, v, { padding });
      const resized = was !== null && (was.width !== d.width || was.height !== d.height)
        && wasFit !== null && near(wasFit, v);
      if (!resized && v.scale.x > to.scale.x * (1 + ZOOM_TOLERANCE)) {
        fittedAt.current = null;
        return;
      }
      fittedAt.current = { width: d.width, height: d.height };
      if (!near(to, v)) sendView(sink, to);
    }, PAGE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready, view.x, view.y, view.scale.x, view.scale.y, dims.width, dims.height, pages.placed, latest, padding]);
}
