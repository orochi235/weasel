import { watchDevicePixelRatio } from '@weasel-js/core/engine';
import { useLatest, useVisibleRaf } from '@weasel-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SurfaceScope } from './measureTiles';
import type { Box } from './rect';
import {
  type SurfaceClear,
  type SurfaceFrame,
  TiledSurface,
  type TilePainter,
} from './tiledSurface';
import { useElementWatch } from './useElementWatch';

export type { SurfaceClear, SurfaceFrame, TilePainter } from './tiledSurface';

/** The invalidators and the two ref callbacks that publish geometry. */
export interface SurfaceHandle {
  /** Mark one tile for redraw. */
  invalidate: (id: string) => void;
  /** Mark every tile — what a resize or a tile-set change means. */
  invalidateAll: () => void;
  /** Mark every tile overlapping `box`, in viewport px as `getBoundingClientRect`
   *  gives them: what something drawn over the tiles leaves behind when it moves. */
  invalidateBox: (box: Box) => void;
  /** Re-measure before the next frame. The escape hatch for a host that knows it
   *  moved something a ResizeObserver cannot see. */
  invalidateRects: () => void;
  /** Publish `el`'s rect under `id`, or with `null` drop it. Throws when another
   *  element still in the document holds `id`; `registerClear` and
   *  `registerPainter` throw likewise on an id not yet released. */
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
  /** Narrow the surface to the tiles inside `el` (or inside any of a list),
   *  or widen it back with `null`. A tile outside drops out of the frame's
   *  `rects` and is not painted, and the frame is retiled so the buffer is
   *  cleared of it — what an expanded tile needs, with the buffers lifted over
   *  the rest. */
  scope: (el: SurfaceScope) => void;
  /** Whether the tile is inside the current scope. Everything is, unscoped. */
  inScope: (id: string) => boolean;
  /** Called whenever the scope changes. Returns the unsubscribe. */
  subscribeScope: (listener: () => void) => () => void;
}

/** Inputs to `useTiledSurface`. `onFrame` runs once per frame that has dirty
 *  tiles, before any tile paints — the place to size the shared buffer. */
export interface UseTiledSurfaceOptions {
  onFrame: (frame: SurfaceFrame) => void;
}

/**
 * Calls `onScroll` on a scroll anywhere in `doc`. A scroll moves tiles against the container, and the observers
 * behind `watch` report that only after the frame has drawn: a press in between lands on the box of whatever tile
 * was there. The scroll event comes ahead of the frame's callbacks, so measuring on it moves the boxes in the frame
 * the scroll draws in. The whole document, since the scroller holding a tile need not be inside the container: a
 * lab's is a layer beside its trials.
 */
function onAnyScroll(doc: Document, onScroll: () => void): () => void {
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return () => doc.removeEventListener('scroll', onScroll, true);
}

/** The handle's methods: each records its work on `surface`, then asks for a frame. */
function createSurfaceHandle(
  surface: TiledSurface,
  schedule: () => void,
  invalidateRects: () => void,
  watch: ReturnType<typeof useElementWatch>['watch'],
  unlistenScroll: { current: (() => void) | null },
): SurfaceHandle {
  return {
    invalidate: (id) => {
      surface.invalidate(id);
      schedule();
    },
    invalidateAll: () => {
      surface.invalidateAll();
      schedule();
    },
    invalidateBox: (box) => {
      if (surface.invalidateBox(box)) schedule();
    },
    invalidateRects,
    registerTile: (id, el) => {
      if (!surface.placeTile(id, el)) return;
      watch(`tile:${id}`, el, { moves: true });
      schedule();
    },
    registerClear: (id, clear) => surface.holdClear(id, clear),
    registerPainter: (id, paint) => surface.holdPainter(id, paint),
    containerRef: (el) => {
      if (!surface.setContainer(el)) return;
      watch('container', el);
      unlistenScroll.current?.();
      unlistenScroll.current = el ? onAnyScroll(el.ownerDocument, invalidateRects) : null;
      schedule();
    },
    getContainer: () => surface.getContainer(),
    scope: (el) => {
      if (surface.setScope(el)) schedule();
    },
    inScope: (id) => surface.inScope(id),
    subscribeScope: (listener) => surface.subscribeScope(listener),
  };
}

/**
 * Share one drawing buffer among tiles laid out by the DOM. Tiles register
 * their elements; the hook measures them against the container, re-measures on
 * resize, and batches invalidations into one visible-only frame that calls
 * `onFrame`, then (on a retiled frame) the registered clears, then each dirty
 * tile's painter.
 */
export function useTiledSurface({ onFrame }: UseTiledSurfaceOptions): SurfaceHandle {
  const [surface] = useState(() => new TiledSurface());

  // Held in a ref so a caller passing an inline closure does not re-create the
  // handle on each render.
  const onFrameRef = useLatest(onFrame);

  const frameLoop = useVisibleRaf(
    (_time, frameLoop) => {
      if (surface.step(onFrameRef.current)) frameLoop.request();
    },
    // The host attaches its container through `containerRef`, which may land
    // well after this hook's first effect; the gate re-resolves it per request.
    { target: () => surface.getContainer() },
  );
  const schedule = frameLoop.request;

  const invalidateRects = useCallback(() => {
    surface.invalidateRects();
    schedule();
  }, [surface, schedule]);

  const { watch } = useElementWatch(invalidateRects);
  const unlistenScroll = useRef<(() => void) | null>(null);

  useEffect(() => () => frameLoop.cancel(), [frameLoop]);

  // A window moved to a display of another density keeps its CSS box, so no observer fires.
  useEffect(() => watchDevicePixelRatio(invalidateRects), [invalidateRects]);

  return useMemo(
    () => createSurfaceHandle(surface, schedule, invalidateRects, watch, unlistenScroll),
    [surface, schedule, invalidateRects, watch],
  );
}
