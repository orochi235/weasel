import { useCallback, useMemo, useRef, useState } from 'react';
import type { ModifierState } from '../types';

/** Pointer position in both world (gesture-coord) and client (CSS-px) space. */
export interface DragGesturePoint {
  worldX: number;
  worldY: number;
  clientX: number;
  clientY: number;
}

/** Phase exposed on the public controller and inside ctx for callbacks. */
export type DragGesturePhase = 'idle' | 'pending' | 'active';

/** Live gesture context handed to lifecycle callbacks. Within callbacks, ctx
 *  reflects the moment the callback fires (e.g. ctx.phase is 'active' inside
 *  onActivate, even though the move that triggered it was during 'pending'). */
export interface DragGestureCtx<TScratch = unknown> {
  start: DragGesturePoint;
  current: DragGesturePoint;
  modifiers: ModifierState;
  scratch: TScratch;
  /** 'pending' or 'active'. Never 'idle' inside a callback. */
  phase: 'pending' | 'active';
}

/** The context handed to `onEnd`, adding whether the gesture ever passed its
 *  activation threshold. */
export interface DragGestureEndCtx<TScratch = unknown>
  extends DragGestureCtx<TScratch> {
  /** True if phase never reached 'active'. Wrappers without thresholdReached
   *  always see false here (their gesture activates at start()). */
  wasSubThreshold: boolean;
}

/** Options for `useDragGesture`: when the gesture becomes active, and what to
 *  do at each point in its lifecycle. */
export interface UseDragGestureOptions<TScratch = unknown> {
  initScratch?: () => TScratch;
  /** Predicate consulted on each move while phase === 'pending'. Return true
   *  to transition to 'active'. The transition fires onActivate before the
   *  triggering move's onMove. When omitted, gesture activates at start(). */
  thresholdReached?: (ctx: DragGestureCtx<TScratch>) => boolean;
  onStart?: (ctx: DragGestureCtx<TScratch>) => void;
  onActivate?: (ctx: DragGestureCtx<TScratch>) => void;
  onMove?: (ctx: DragGestureCtx<TScratch>) => void;
  onEnd?: (ctx: DragGestureEndCtx<TScratch>) => boolean | void;
  onCancel?: (ctx: DragGestureCtx<TScratch>) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}

/** Drives a drag gesture. The owner feeds it pointer positions; it decides
 *  when the drag has really begun and calls back accordingly. */
export interface DragGestureController {
  start(point: DragGesturePoint, modifiers: ModifierState): void;
  move(point: DragGesturePoint, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  readonly phase: DragGesturePhase;
  readonly isActive: boolean;
}

interface InternalState<TScratch> {
  phase: 'pending' | 'active';
  start: DragGesturePoint;
  current: DragGesturePoint;
  modifiers: ModifierState;
  scratch: TScratch;
}

/**
 * The base drag primitive: tracks a pointer from press to release, with an
 * optional threshold below which the gesture stays pending and commits
 * nothing.
 *
 * It is a gesture and only a gesture — it says where the pointer went, never
 * what that should do. `useDragRect` and `useDragRadial` build on it, and
 * actions decide what to make of the result.
 */
export function useDragGesture<TScratch = unknown>(
  options: UseDragGestureOptions<TScratch> = {},
): DragGestureController {
  const optsRef = useRef(options);
  optsRef.current = options;
  const stateRef = useRef<InternalState<TScratch> | null>(null);
  const [, setPhaseTick] = useState(0);
  const phaseRef = useRef<DragGesturePhase>('idle');
  const bumpPhase = useCallback((next: DragGesturePhase) => {
    phaseRef.current = next;
    setPhaseTick((n) => n + 1);
  }, []);

  const buildCtx = useCallback((): DragGestureCtx<TScratch> => {
    const s = stateRef.current!;
    return {
      get start() { return s.start; },
      get current() { return s.current; },
      get modifiers() { return s.modifiers; },
      get scratch() { return s.scratch; },
      get phase() { return s.phase; },
    };
  }, []);

  const start = useCallback((point: DragGesturePoint, modifiers: ModifierState) => {
    const opts = optsRef.current;
    const scratch = opts.initScratch ? opts.initScratch() : ({} as TScratch);
    const initialPhase: 'pending' | 'active' = opts.thresholdReached ? 'pending' : 'active';
    stateRef.current = {
      phase: initialPhase,
      start: point,
      current: point,
      modifiers,
      scratch,
    };
    bumpPhase(initialPhase);
    opts.onGestureStart?.();
    opts.onStart?.(buildCtx());
  }, [buildCtx, bumpPhase]);

  const move = useCallback((point: DragGesturePoint, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s) return false;
    s.current = point;
    s.modifiers = modifiers;
    const opts = optsRef.current;
    if (s.phase === 'pending' && opts.thresholdReached) {
      const ctx = buildCtx();
      if (opts.thresholdReached(ctx)) {
        s.phase = 'active';
        bumpPhase('active');
        opts.onActivate?.(buildCtx());
      }
    }
    opts.onMove?.(buildCtx());
    return true;
  }, [buildCtx, bumpPhase]);

  const end = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (!s) {
      opts.onGestureEnd?.(false);
      return;
    }
    const wasSubThreshold = s.phase === 'pending';
    const endCtx: DragGestureEndCtx<TScratch> = {
      get start() { return s.start; },
      get current() { return s.current; },
      get modifiers() { return s.modifiers; },
      get scratch() { return s.scratch; },
      get phase() { return s.phase; },
      wasSubThreshold,
    };
    let committed = false;
    try {
      const r = opts.onEnd?.(endCtx);
      committed = r !== false;
    } finally {
      stateRef.current = null;
      bumpPhase('idle');
      opts.onGestureEnd?.(committed);
    }
  }, [bumpPhase]);

  const cancel = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (s) opts.onCancel?.(buildCtx());
    stateRef.current = null;
    bumpPhase('idle');
    opts.onGestureEnd?.(false);
  }, [buildCtx, bumpPhase]);

  return useMemo<DragGestureController>(() => ({
    start, move, end, cancel,
    get phase() { return phaseRef.current; },
    get isActive() { return phaseRef.current !== 'idle'; },
  }), [start, move, end, cancel]);
}
