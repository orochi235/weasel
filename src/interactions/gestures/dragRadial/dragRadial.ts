import { useCallback, useMemo, useRef, useState } from 'react';
import { useDragGesture } from '../dragGesture';
import type { ModifierState } from '../types';
import { dlog } from '../../../debug/flag';

export interface DragRadialPoint { x: number; y: number }

export interface DragRadialState {
  center: DragRadialPoint;
  radius: number;
  rotation: number;
}

export interface DragRadialCtx<TScratch = unknown> extends DragRadialState {
  modifiers: ModifierState;
  scratch: TScratch;
}

export interface DragRadialEndCtx<TScratch = unknown> extends DragRadialCtx<TScratch> {
  /** True at end time if the radius is at or below `minRadius`. */
  isSubThreshold: boolean;
}

export interface UseDragRadialOptions<TScratch = unknown> {
  minRadius?: number;
  initScratch?: () => TScratch;
  onStart?: (ctx: DragRadialCtx<TScratch>) => void;
  onMove?: (ctx: DragRadialCtx<TScratch>) => void;
  onEnd?: (ctx: DragRadialEndCtx<TScratch>) => boolean | void;
  onCancel?: (ctx: DragRadialCtx<TScratch>) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Optional: snap world-space points to the active grid (or any other
   *  snap target). Applied to both the center (on `onStart`) and the
   *  current cursor (on `onMove`), so the live overlay's radius/rotation
   *  is computed from snapped points instead of raw cursor positions.
   *  When omitted, behavior is identical to today (identity passthrough). */
  snapPoint?: (p: DragRadialPoint) => DragRadialPoint;
}

export interface DragRadialController {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  overlay: DragRadialState | null;
  readonly isActive: boolean;
}

interface DragRadialScratch<TConsumer> {
  center: DragRadialPoint;
  current: DragRadialPoint;
  modifiers: ModifierState;
  consumer: TConsumer;
}

function stateFrom(s: DragRadialScratch<unknown>): DragRadialState {
  const dx = s.current.x - s.center.x;
  const dy = s.current.y - s.center.y;
  return {
    center: { ...s.center },
    radius: Math.hypot(dx, dy),
    rotation: dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx),
  };
}

/**
 * Radial gesture: pointerdown sets center, pointermove updates radius (Math.hypot
 * of delta) and rotation (Math.atan2 of delta), pointerup commits. Shared by polygon
 * and star tools. Modifier key state is read at end time from `ctx.modifiers`.
 */
export function useDragRadial<TScratch = unknown>(
  options: UseDragRadialOptions<TScratch> = {},
): DragRadialController {
  const optsRef = useRef(options);
  optsRef.current = options;

  const [overlay, setOverlay] = useState<DragRadialState | null>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const scratchRef = useRef<DragRadialScratch<TScratch> | null>(null);

  const writeOverlay = useCallback(() => {
    const s = scratchRef.current;
    if (!s) return;
    setOverlay(stateFrom(s));
  }, []);

  const buildCtx = useCallback((): DragRadialCtx<TScratch> => {
    const s = scratchRef.current!;
    const state = stateFrom(s);
    return {
      ...state,
      modifiers: s.modifiers,
      scratch: s.consumer,
    };
  }, []);

  const gesture = useDragGesture<DragRadialScratch<TScratch>>({
    initScratch: () => {
      const init = optsRef.current.initScratch
        ? optsRef.current.initScratch()
        : ({} as TScratch);
      return {
        center: { x: 0, y: 0 },
        current: { x: 0, y: 0 },
        modifiers: { shift: false, alt: false, meta: false, ctrl: false },
        consumer: init,
      };
    },
    onStart: (ctx) => {
      const opts = optsRef.current;
      const raw: DragRadialPoint = { x: ctx.start.worldX, y: ctx.start.worldY };
      const p: DragRadialPoint = opts.snapPoint ? opts.snapPoint(raw) : raw;
      ctx.scratch.center = p;
      ctx.scratch.current = p;
      ctx.scratch.modifiers = ctx.modifiers;
      scratchRef.current = ctx.scratch;
      setOverlay({ center: p, radius: 0, rotation: 0 });
      dlog('drag-radial', 'start', p);
      opts.onStart?.(buildCtx());
    },
    onMove: (ctx) => {
      const opts = optsRef.current;
      const raw: DragRadialPoint = { x: ctx.current.worldX, y: ctx.current.worldY };
      ctx.scratch.current = opts.snapPoint ? opts.snapPoint(raw) : raw;
      ctx.scratch.modifiers = ctx.modifiers;
      writeOverlay();
      opts.onMove?.(buildCtx());
    },
    onEnd: (ctx) => {
      const opts = optsRef.current;
      const state = stateFrom(ctx.scratch);
      const min = opts.minRadius ?? 0;
      const endCtx: DragRadialEndCtx<TScratch> = {
        ...state,
        modifiers: ctx.scratch.modifiers,
        scratch: ctx.scratch.consumer,
        isSubThreshold: state.radius <= min,
      };
      dlog('drag-radial', 'end', { radius: state.radius, rotation: state.rotation, isSubThreshold: endCtx.isSubThreshold });
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
      dlog('drag-radial', 'cancel');
      optsRef.current.onCancel?.(buildCtx());
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

  return useMemo<DragRadialController>(() => ({
    start,
    move,
    end: gesture.end,
    cancel: gesture.cancel,
    get overlay() { return overlayRef.current; },
    get isActive() { return overlayRef.current !== null; },
  }), [start, move, gesture.end, gesture.cancel]);
}
