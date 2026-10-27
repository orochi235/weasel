import { useCallback, useMemo, useRef, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import { useDragGesture } from '../dragGesture';
import type { ModifierState } from '../types';
import type { WorldPoint } from '@weasel-js/routing';
import { dlog } from '../../../debug/flag';

/** A point in world coordinates. */
export type DragRadialPoint = WorldPoint;

/** A radial drag expressed as its center and the polar coordinates of the
 *  cursor relative to it. */
export interface DragRadialState {
  center: DragRadialPoint;
  radius: number;
  rotation: number;
}

/** Live state of a radial drag, handed to each lifecycle callback. */
export interface DragRadialCtx<TScratch = unknown> extends DragRadialState {
  modifiers: ModifierState;
  scratch: TScratch;
}

/** The context handed to `onEnd`, adding whether the final radius is too
 *  small to be meaningful. */
export interface DragRadialEndCtx<TScratch = unknown> extends DragRadialCtx<TScratch> {
  /** True at end time if the radius is at or below `minRadius`. */
  isSubThreshold: boolean;
}

/** Options for `useDragRadial`. */
export interface UseDragRadialOptions<TScratch = unknown> {
  minRadius?: number;
  initScratch?: () => TScratch;
  onStart?: (ctx: DragRadialCtx<TScratch>) => void;
  onMove?: (ctx: DragRadialCtx<TScratch>) => void;
  onEnd?: (ctx: DragRadialEndCtx<TScratch>) => boolean | void;
  onCancel?: (ctx: DragRadialCtx<TScratch>) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}

/** Drives a radial drag and publishes the live center/radius/rotation for
 *  overlay drawing. */
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
  const optsRef = useLatest(options);

  const [overlay, setOverlay] = useState<DragRadialState | null>(null);

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
      const p: DragRadialPoint = { x: ctx.start.worldX, y: ctx.start.worldY };
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
      ctx.scratch.current = { x: ctx.current.worldX, y: ctx.current.worldY };
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
    overlay,
    isActive: overlay !== null,
  }), [start, move, gesture.end, gesture.cancel, overlay]);
}
