import { useCallback, useLayoutEffect, useState } from 'react';

/** The least each pane may be laid out at. */
export interface SplitFloors {
  sidebar: number;
  content: number;
}

/**
 * The floors a strip `zone` pixels wide can hold. A zone too narrow for both gives way: the sidebar's floor shrinks
 * first, down to nothing, and only then the content's. `zone` is null before anything has measured it.
 */
export function splitFloors(
  zone: number | null,
  hasSidebar: boolean,
  sidebar: number,
  content: number,
): SplitFloors {
  if (zone === null) return { sidebar, content };
  const held = hasSidebar ? Math.max(0, Math.min(sidebar, zone - content)) : 0;
  return { sidebar: hasSidebar ? held : sidebar, content: Math.min(content, zone - held) };
}

/** `el`'s content box width, as a `ResizeObserver` entry's `contentRect` gives it. */
function contentWidth(el: Element): number {
  const style = getComputedStyle(el);
  const padding =
    (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
  return Math.max(0, el.clientWidth - padding);
}

/**
 * The width of the strip whose boxless wrapper the returned ref attaches to: `fixed` when the caller supplies an
 * extent, else the content box of the element the strip fills. Null until it has been measured. Read as the
 * wrapper attaches, ahead of the strip's own first layout, so the floors hold from the first painted frame. The zone
 * itself is not what is measured: it grows past what it fills to hold panes that overflow, which the floors decide.
 */
export function useZoneWidth(
  fixed: number | undefined,
): [width: number | null, frameRef: (el: HTMLElement | null) => void] {
  const [measured, setMeasured] = useState<number | null>(null);
  const [strip, setStrip] = useState<Element | null>(null);
  const frameRef = useCallback((el: HTMLElement | null) => {
    const parent = el?.parentElement ?? null;
    setStrip(parent);
    // Nothing laid out yet reads as no width: the observer reports it.
    const now = parent ? contentWidth(parent) : 0;
    if (now > 0) setMeasured(now);
  }, []);
  useLayoutEffect(() => {
    if (fixed !== undefined || !strip || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setMeasured(width);
    });
    observer.observe(strip);
    return () => observer.disconnect();
  }, [strip, fixed]);
  return [fixed ?? measured, frameRef];
}
