import { useCallback, useMemo, useRef, useState } from 'react';
import type { ModifierState } from './types';

export interface DragRectPoint { x: number; y: number }
export interface DragRectBounds { x: number; y: number; width: number; height: number }

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

export interface DragRectEndCtx<TScratch = unknown> extends DragRectCtx<TScratch> {
  wasSubThreshold: boolean;
}

export interface UseDragRectOptions<TScratch = unknown> {
  minBounds?: { width: number; height: number };
  initScratch?: () => TScratch;
  onStart?: (ctx: DragRectCtx<TScratch>) => void;
  onMove?: (ctx: DragRectCtx<TScratch>) => void;
  onEnd?: (ctx: DragRectEndCtx<TScratch>) => boolean | void;
  onCancel?: (ctx: DragRectCtx<TScratch>) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}

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

interface InternalState<TScratch> {
  active: boolean;
  start: DragRectPoint;
  current: DragRectPoint;
  modifiers: ModifierState;
  scratch: TScratch;
}

export function useDragRect<TScratch = unknown>(
  options: UseDragRectOptions<TScratch> = {},
): DragRectController {
  const optsRef = useRef(options);
  optsRef.current = options;
  const stateRef = useRef<InternalState<TScratch> | null>(null);
  const [overlay, setOverlay] = useState<DragRectController['overlay']>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const buildCtx = useCallback((): DragRectCtx<TScratch> => {
    const s = stateRef.current!;
    const ctx: DragRectCtx<TScratch> = {
      get start() { return s.start; },
      get current() { return s.current; },
      get bounds() { return boundsFrom(s.start, s.current); },
      get modifiers() { return s.modifiers; },
      get scratch() { return s.scratch; },
      setStart(p) {
        s.start = p;
        setOverlay({ start: s.start, current: s.current, bounds: boundsFrom(s.start, s.current) });
      },
      setCurrent(p) {
        s.current = p;
        setOverlay({ start: s.start, current: s.current, bounds: boundsFrom(s.start, s.current) });
      },
    };
    return ctx;
  }, []);

  const start = useCallback((worldX: number, worldY: number, modifiers: ModifierState) => {
    // Restart while active replaces state silently — no onCancel/onEnd. Matches existing gesture-hook behavior; restart abandons in-flight scratch.
    const opts = optsRef.current;
    const init = opts.initScratch ? opts.initScratch() : ({} as TScratch);
    const p: DragRectPoint = { x: worldX, y: worldY };
    stateRef.current = {
      active: true,
      start: p,
      current: p,
      modifiers,
      scratch: init,
    };
    setOverlay({ start: p, current: p, bounds: { x: p.x, y: p.y, width: 0, height: 0 } });
    opts.onStart?.(buildCtx());
    opts.onGestureStart?.();
  }, [buildCtx]);

  const move = useCallback((worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s || !s.active) return false;
    s.current = { x: worldX, y: worldY };
    s.modifiers = modifiers;
    setOverlay({ start: s.start, current: s.current, bounds: boundsFrom(s.start, s.current) });
    optsRef.current.onMove?.(buildCtx());
    return true;
  }, [buildCtx]);

  const end = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (!s || !s.active) {
      opts.onGestureEnd?.(false);
      return;
    }
    const min = opts.minBounds ?? { width: 0, height: 0 };
    const b = boundsFrom(s.start, s.current);
    const wasSubThreshold = b.width <= min.width || b.height <= min.height;
    const baseCtx = buildCtx();
    // endCtx must expose all DragRectCtx getters plus wasSubThreshold.
    const endCtx = Object.create(null) as DragRectEndCtx<TScratch>;
    Object.defineProperties(endCtx, {
      start: Object.getOwnPropertyDescriptor(baseCtx, 'start')!,
      current: Object.getOwnPropertyDescriptor(baseCtx, 'current')!,
      bounds: Object.getOwnPropertyDescriptor(baseCtx, 'bounds')!,
      modifiers: Object.getOwnPropertyDescriptor(baseCtx, 'modifiers')!,
      scratch: Object.getOwnPropertyDescriptor(baseCtx, 'scratch')!,
    });
    endCtx.setStart = baseCtx.setStart;
    endCtx.setCurrent = baseCtx.setCurrent;
    (endCtx as { wasSubThreshold: boolean }).wasSubThreshold = wasSubThreshold;
    let committed = false;
    try {
      const r = opts.onEnd?.(endCtx);
      committed = r === false ? false : true;
    } finally {
      stateRef.current = null;
      setOverlay(null);
      opts.onGestureEnd?.(committed);
    }
  }, [buildCtx]);

  const cancel = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (s && s.active) opts.onCancel?.(buildCtx());
    stateRef.current = null;
    setOverlay(null);
    opts.onGestureEnd?.(false);
  }, [buildCtx]);

  return useMemo<DragRectController>(() => ({
    start, move, end, cancel,
    get overlay() { return overlayRef.current; },
    get isActive() { return overlayRef.current !== null; },
  }), [start, move, end, cancel]);
}
