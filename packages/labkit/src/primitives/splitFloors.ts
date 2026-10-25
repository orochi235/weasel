import { useLayoutEffect, useState } from 'react';

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

/**
 * The width of the strip `inside` is rendered in: `fixed` when the caller supplies an extent, else the strip's own
 * measured box. Null until it has been measured, which waits on `inside`: a strip renders no pane before its first
 * layout.
 */
export function useZoneWidth(inside: Element | null, fixed: number | undefined): number | null {
  const [measured, setMeasured] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (fixed !== undefined || typeof ResizeObserver === 'undefined') return;
    const zone = inside?.closest('[data-node-container]');
    if (!zone) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setMeasured(width);
    });
    // The pane mounts inside windease's own observer callback, and an element observed during that delivery at
    // the strip's depth is skipped, which Chrome reports as a ResizeObserver loop. Start after it.
    const start = setTimeout(() => observer.observe(zone), 0);
    return () => {
      clearTimeout(start);
      observer.disconnect();
    };
  }, [inside, fixed]);
  return fixed ?? measured;
}
