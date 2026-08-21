import { useCallback, useMemo, useRef, useState } from 'react';
import { useDragGesture } from '../dragGesture';
import type { ModifierState } from '../types';
import { dlog } from '../../../debug/flag';

/** A point in world coordinates. */
export interface DragRectPoint { x: number; y: number }
/** The axis-aligned box between the drag's two corners, always with
 *  non-negative extents regardless of drag direction. */
export interface DragRectBounds { x: number; y: number; width: number; height: number }

/** Live state of a rectangle drag, handed to each lifecycle callback. Either
 *  corner can be moved mid-gesture, which is how a tool re-anchors a drag
 *  without restarting it. */
export interface DragRectCtx<TScratch = unknown> {
  start: DragRectPoint;
  current: DragRectPoint;
  bounds: DragRectBounds;
  modifiers: ModifierState;
  scratch: TScratch;
  /** Override the start point mid-gesture. Recomputes bounds and updates the
   *  live overlay so the next move (and the end ctx) reflect the new value. */
  setStart(p: DragRectPoint): void;
  /** Override the current point mid-gesture (between start and end). */
  setCurrent(p: DragRectPoint): void;
}

/** The context handed to `onEnd`, adding whether the final box is too small
 *  to be meaningful. */
export interface DragRectEndCtx<TScratch = unknown> extends DragRectCtx<TScratch> {
  /** True if the end-time bounds are at or below `minBounds` on either axis.
   *  Present-tense state check — distinct from the base's retrospective
   *  `wasSubThreshold`. Computed by this wrapper, not by `useDragGesture`. */
  isSubThreshold: boolean;
}

/** Options for `useDragRect`. */
export interface UseDragRectOptions<TScratch = unknown> {
  minBounds?: { width: number; height: number };
  initScratch?: () => TScratch;
  onStart?: (ctx: DragRectCtx<TScratch>) => void;
  onMove?: (ctx: DragRectCtx<TScratch>) => void;
  onEnd?: (ctx: DragRectEndCtx<TScratch>) => boolean | void;
  onCancel?: (ctx: DragRectCtx<TScratch>) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Optional: snap world-space points to the active grid (or any other
   *  snap target). Applied to every coord the gesture ingests (start point
   *  on `onStart`, current point on `onMove`), so both the live overlay
   *  and the committed bounds track the snapped values. When omitted,
   *  behavior is identical to today (identity passthrough). */
  snapPoint?: (p: DragRectPoint) => DragRectPoint;
}

/** Drives a rectangle drag and publishes the live box for overlay drawing. */
export interface DragRectController {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  overlay: { start: DragRectPoint; current: DragRectPoint; bounds: DragRectBounds } | null;
  readonly isActive: boolean;
}

function boundsFrom(start: DragRectPoint, current: DragRectPoint): DragRectBounds {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

interface DragRectScratch<TConsumer> {
  start: DragRectPoint;
  current: DragRectPoint;
  modifiers: ModifierState;
  consumer: TConsumer;
}

/**
 * The gesture "the user drew a rectangle": press, drag, release, with the
 * resulting box reported live and at commit.
 *
 * It is a spatial input primitive, not an insert mechanism — what the box
 * means is entirely up to whoever consumes it. Marquee selection, cropping and
 * shape insertion all sit on top of the same gesture.
 */
export function useDragRect<TScratch = unknown>(
  options: UseDragRectOptions<TScratch> = {},
): DragRectController {
  const optsRef = useRef(options);
  optsRef.current = options;

  const [overlay, setOverlay] = useState<DragRectController['overlay']>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const scratchRef = useRef<DragRectScratch<TScratch> | null>(null);

  const writeOverlay = useCallback(() => {
    const s = scratchRef.current;
    if (!s) return;
    setOverlay({
      start: s.start,
      current: s.current,
      bounds: boundsFrom(s.start, s.current),
    });
  }, []);

  const buildConsumerCtx = useCallback((): DragRectCtx<TScratch> => {
    const s = scratchRef.current!;
    return {
      get start() { return s.start; },
      get current() { return s.current; },
      get bounds() { return boundsFrom(s.start, s.current); },
      get modifiers() { return s.modifiers; },
      get scratch() { return s.consumer; },
      setStart(p) { s.start = p; writeOverlay(); },
      setCurrent(p) { s.current = p; writeOverlay(); },
    };
  }, [writeOverlay]);

  const gesture = useDragGesture<DragRectScratch<TScratch>>({
    initScratch: () => {
      const init = optsRef.current.initScratch
        ? optsRef.current.initScratch()
        : ({} as TScratch);
      return {
        start: { x: 0, y: 0 },
        current: { x: 0, y: 0 },
        modifiers: { shift: false, alt: false, meta: false, ctrl: false },
        consumer: init,
      };
    },
    onStart: (ctx) => {
      const opts = optsRef.current;
      const raw: DragRectPoint = { x: ctx.start.worldX, y: ctx.start.worldY };
      const p: DragRectPoint = opts.snapPoint ? opts.snapPoint(raw) : raw;
      dlog('drag-rect', 'start', p);
      ctx.scratch.start = p;
      ctx.scratch.current = p;
      scratchRef.current = ctx.scratch;
      ctx.scratch.modifiers = ctx.modifiers;
      setOverlay({ start: p, current: p, bounds: { x: p.x, y: p.y, width: 0, height: 0 } });
      opts.onStart?.(buildConsumerCtx());
    },
    onMove: (ctx) => {
      const opts = optsRef.current;
      const raw: DragRectPoint = { x: ctx.current.worldX, y: ctx.current.worldY };
      ctx.scratch.current = opts.snapPoint ? opts.snapPoint(raw) : raw;
      ctx.scratch.modifiers = ctx.modifiers;
      writeOverlay();
      opts.onMove?.(buildConsumerCtx());
    },
    onEnd: (ctx) => {
      const opts = optsRef.current;
      const min = opts.minBounds ?? { width: 0, height: 0 };
      const b = boundsFrom(ctx.scratch.start, ctx.scratch.current);
      const isSubThreshold = b.width <= min.width || b.height <= min.height;
      const s = ctx.scratch;
      const endCtx: DragRectEndCtx<TScratch> = {
        get start() { return s.start; },
        get current() { return s.current; },
        get bounds() { return boundsFrom(s.start, s.current); },
        get modifiers() { return s.modifiers; },
        get scratch() { return s.consumer; },
        setStart(p) { s.start = p; writeOverlay(); },
        setCurrent(p) { s.current = p; writeOverlay(); },
        isSubThreshold,
      };
      dlog('drag-rect', 'end', { bounds: b, isSubThreshold });
      let r: boolean | void;
      try {
        r = opts.onEnd?.(endCtx);
      } finally {
        scratchRef.current = null;
        setOverlay(null);
      }
      return r;
    },
    onCancel: () => {
      dlog('drag-rect', 'cancel');
      optsRef.current.onCancel?.(buildConsumerCtx());
      scratchRef.current = null;
      setOverlay(null);
    },
    onGestureStart: () => optsRef.current.onGestureStart?.(),
    onGestureEnd: (committed) => optsRef.current.onGestureEnd?.(committed),
  });

  const start = useCallback((worldX: number, worldY: number, modifiers: ModifierState) => {
    gesture.start({ worldX, worldY, clientX: worldX, clientY: worldY }, modifiers);
  }, [gesture]);

  const move = useCallback((worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    return gesture.move({ worldX, worldY, clientX: worldX, clientY: worldY }, modifiers);
  }, [gesture]);

  return useMemo<DragRectController>(() => ({
    start,
    move,
    end: gesture.end,
    cancel: gesture.cancel,
    get overlay() { return overlayRef.current; },
    get isActive() { return overlayRef.current !== null; },
  }), [start, move, gesture.end, gesture.cancel]);
}
