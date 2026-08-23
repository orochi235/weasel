import { useCallback, useEffect, useRef } from 'react';
import { composeRects, rectsEqual } from './composeRects';
import type { Box, Rect } from './rect';

/** What a surface owner is handed once per animation frame. `rects` carries every
 *  tile, not only the dirty ones: a scissored draw has to know where it is drawing
 *  relative to a surface that may have resized under it. */
export interface SurfaceFrame {
  dirty: ReadonlySet<string>;
  rects: ReadonlyMap<string, Rect>;
  dpr: number;
  size: { width: number; height: number };
}

/** The invalidators and the two ref callbacks that publish geometry. */
export interface SurfaceHandle {
  /** Mark one tile for redraw. */
  invalidate: (id: string) => void;
  /** Mark every tile — what a resize or a tile-set change means. */
  invalidateAll: () => void;
  /** Re-measure before the next frame. The escape hatch for a host that knows it
   *  moved something a ResizeObserver cannot see. */
  invalidateRects: () => void;
  registerTile: (id: string, el: HTMLElement | null) => void;
  containerRef: (el: HTMLElement | null) => void;
}

export interface UseTiledSurfaceOptions {
  onFrame: (frame: SurfaceFrame) => void;
}

export function useTiledSurface({ onFrame }: UseTiledSurfaceOptions): SurfaceHandle {
  const container = useRef<HTMLElement | null>(null);
  const tiles = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, Rect>());
  const dirty = useRef(new Set<string>());
  const needsMeasure = useRef(true);
  const raf = useRef(0);
  const observer = useRef<ResizeObserver | null>(null);
  const lastDpr = useRef(0);

  // Held in a ref so a caller passing an inline closure does not re-create every
  // callback below on each render.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const measure = useCallback((): boolean => {
    const el = container.current;
    if (!el) return false;
    const boxes = new Map<string, Box>();
    for (const [id, tile] of tiles.current) boxes.set(id, tile.getBoundingClientRect());
    const next = composeRects(el.getBoundingClientRect(), boxes);
    let changed = next.size !== rects.current.size;
    for (const [id, rect] of next) {
      if (!rectsEqual(rects.current.get(id), rect)) changed = true;
    }
    rects.current = next;
    return changed;
  }, []);

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = container.current;
      if (!el) {
        dirty.current.clear();
        return;
      }
      if (needsMeasure.current) {
        needsMeasure.current = false;
        if (measure()) for (const id of rects.current.keys()) dirty.current.add(id);
      }
      const dpr = globalThis.devicePixelRatio ?? 1;
      if (dpr !== lastDpr.current) {
        lastDpr.current = dpr;
        for (const id of rects.current.keys()) dirty.current.add(id);
      }
      if (dirty.current.size === 0) return;
      const box = el.getBoundingClientRect();
      onFrameRef.current({
        dirty: new Set(dirty.current),
        rects: new Map(rects.current),
        dpr,
        size: { width: box.width, height: box.height },
      });
      dirty.current.clear();
    });
  }, [measure]);

  const invalidate = useCallback(
    (id: string) => {
      dirty.current.add(id);
      schedule();
    },
    [schedule],
  );

  const invalidateAll = useCallback(() => {
    for (const id of tiles.current.keys()) dirty.current.add(id);
    schedule();
  }, [schedule]);

  const invalidateRects = useCallback(() => {
    needsMeasure.current = true;
    schedule();
  }, [schedule]);

  const registerTile = useCallback(
    (id: string, el: HTMLElement | null) => {
      const known = tiles.current.get(id);
      if (known === el) return;
      if (known) observer.current?.unobserve(known);
      if (el) {
        tiles.current.set(id, el);
        observer.current?.observe(el);
      } else {
        tiles.current.delete(id);
        rects.current.delete(id);
        dirty.current.delete(id);
      }
      needsMeasure.current = true;
      schedule();
    },
    [schedule],
  );

  const containerRef = useCallback(
    (el: HTMLElement | null) => {
      if (container.current === el) return;
      if (container.current) observer.current?.unobserve(container.current);
      container.current = el;
      if (el) observer.current?.observe(el);
      needsMeasure.current = true;
      schedule();
    },
    [schedule],
  );

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      needsMeasure.current = true;
      schedule();
    });
    observer.current = ro;
    if (container.current) ro.observe(container.current);
    for (const el of tiles.current.values()) ro.observe(el);
    return () => {
      ro.disconnect();
      observer.current = null;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [schedule]);

  return { invalidate, invalidateAll, invalidateRects, registerTile, containerRef };
}
