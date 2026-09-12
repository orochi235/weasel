import { useVisibleRaf } from '@weasel-js/core';
import { useCallback, useEffect, useRef } from 'react';
import { composeRects, rectsEqual } from './composeRects';
import type { Box, Rect } from './rect';

/** What a surface owner is handed once per animation frame. `rects` carries every
 *  tile, not only the dirty ones: a scissored draw has to know where it is drawing
 *  relative to a surface that may have resized under it.
 *
 *  Its keys are what `useTileId` returns — `<trial>/<id>` for a tile registered
 *  inside a trial — not the bare id the tile was named with. */
export interface SurfaceFrame {
  dirty: ReadonlySet<string>;
  rects: ReadonlyMap<string, Rect>;
  dpr: number;
  size: { width: number; height: number };
  /** The tile geometry changed this frame — a tile moved, resized, appeared or
   *  went away, or the dpr did. Every tile is dirty on such a frame, but the
   *  pixels a tile vacated are in no tile's scissor now, so the owner clears
   *  the whole buffer. `<Lab>` does; a host owning its own surface must too. */
  retiled: boolean;
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
  /** Register a tenant's whole-buffer clear. Every one registered runs, before
   *  any painter, on a frame where the tile geometry changed — the pixels a
   *  tile vacated are in no scissor now, and only the context that drew them
   *  can erase them. Backend-agnostic by necessity: labkit owns the canvas,
   *  never the context. */
  registerClear: (id: string, clear: SurfaceClear) => () => void;
  /** Subscribe a tile to the frames it is dirty on. A tile paints on its own
   *  loop, so this is how the surface wakes one: a resize of the shared buffer
   *  clears every tile, not only the one that moved. */
  registerPainter: (id: string, paint: TilePainter) => () => void;
  containerRef: (el: HTMLElement | null) => void;
  /** The element tile rects are measured against, and so the one a tile's own
   *  chrome positions itself inside. Null before the owner attaches it. */
  getContainer: () => HTMLElement | null;
}

/** What a tile's painter is handed: where it sits on the surface now, and the
 *  frame that dirtied it. */
export type TilePainter = (rect: Rect, frame: SurfaceFrame) => void;

/** Erase the whole shared buffer. Device pixels, because that is what a GL
 *  viewport takes. */
export type SurfaceClear = (size: { width: number; height: number }, dpr: number) => void;

export interface UseTiledSurfaceOptions {
  onFrame: (frame: SurfaceFrame) => void;
}

export function useTiledSurface({ onFrame }: UseTiledSurfaceOptions): SurfaceHandle {
  const container = useRef<HTMLElement | null>(null);
  const tiles = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, Rect>());
  const dirty = useRef(new Set<string>());
  const painters = useRef(new Map<string, TilePainter>());
  const clears = useRef(new Map<string, SurfaceClear>());
  const needsMeasure = useRef(true);
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

  const frameLoop = useVisibleRaf(
    () => {
      const el = container.current;
      if (!el) {
        dirty.current.clear();
        return;
      }
      let retiled = false;
      if (needsMeasure.current) {
        needsMeasure.current = false;
        if (measure()) {
          retiled = true;
          for (const id of rects.current.keys()) dirty.current.add(id);
        }
      }
      const dpr = globalThis.devicePixelRatio ?? 1;
      if (dpr !== lastDpr.current) {
        lastDpr.current = dpr;
        retiled = true;
        for (const id of rects.current.keys()) dirty.current.add(id);
      }
      if (dirty.current.size === 0) return;
      const box = el.getBoundingClientRect();
      const frame: SurfaceFrame = {
        dirty: new Set(dirty.current),
        rects: new Map(rects.current),
        dpr,
        size: { width: box.width, height: box.height },
        retiled,
      };
      // Cleared before the owner runs, not after the painters: sizing the
      // buffer blanks every tile, so the owner answers with `invalidateAll`,
      // and a set cleared at the end of the frame would swallow it.
      dirty.current.clear();
      onFrameRef.current(frame);
      // After the owner sized the buffer, before anything paints into it.
      if (retiled) {
        for (const clear of clears.current.values()) clear(frame.size, dpr);
      }
      // After the owner, which is what resized the buffer this frame — and
      // whatever it just dirtied paints now rather than a frame later.
      const painting = new Set(frame.dirty);
      for (const id of dirty.current) painting.add(id);
      dirty.current.clear();
      const paintFrame: SurfaceFrame = { ...frame, dirty: painting };
      for (const id of painting) {
        const rect = frame.rects.get(id);
        if (rect) painters.current.get(id)?.(rect, paintFrame);
      }
    },
    // The host attaches its container through `containerRef`, which may land
    // well after this hook's first effect; the gate re-resolves it per request.
    { target: () => container.current },
  );

  const schedule = useCallback(() => {
    frameLoop.request();
  }, [frameLoop]);

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

  const registerClear = useCallback((id: string, clear: SurfaceClear) => {
    clears.current.set(id, clear);
    return () => {
      if (clears.current.get(id) === clear) clears.current.delete(id);
    };
  }, []);

  const registerPainter = useCallback((id: string, paint: TilePainter) => {
    painters.current.set(id, paint);
    return () => {
      if (painters.current.get(id) === paint) painters.current.delete(id);
    };
  }, []);

  const getContainer = useCallback(() => container.current, []);

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
      frameLoop.cancel();
    };
  }, [schedule, frameLoop]);

  return {
    invalidate,
    invalidateAll,
    invalidateRects,
    registerTile,
    registerClear,
    registerPainter,
    containerRef,
    getContainer,
  };
}
