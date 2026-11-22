import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLatest } from '@weasel-js/react';
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
  /** Fired when a gesture opens. A `start()` during a live gesture replaces
   *  it as the same gesture: this does not fire again, and the replaced one
   *  gets no `onCancel` or `onEnd`. */
  onGestureStart?: () => void;
  /** Fired once per `onGestureStart`, when that gesture ends or cancels. */
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

function ctxOf<TScratch>(s: InternalState<TScratch>): DragGestureCtx<TScratch> {
  return {
    get start() { return s.start; },
    get current() { return s.current; },
    get modifiers() { return s.modifiers; },
    get scratch() { return s.scratch; },
    get phase() { return s.phase; },
  };
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
  const optsRef = useLatest(options);
  const stateRef = useRef<InternalState<TScratch> | null>(null);
  const [, setPhaseTick] = useState(0);
  const phaseRef = useRef<DragGesturePhase>('idle');
  const bumpPhase = useCallback((next: DragGesturePhase) => {
    phaseRef.current = next;
    setPhaseTick((n) => n + 1);
  }, []);

  const buildCtx = useCallback((): DragGestureCtx<TScratch> => ctxOf(stateRef.current!), []);

  const start = useCallback((point: DragGesturePoint, modifiers: ModifierState) => {
    const opts = optsRef.current;
    const scratch = opts.initScratch ? opts.initScratch() : ({} as TScratch);
    const initialPhase: 'pending' | 'active' = opts.thresholdReached ? 'pending' : 'active';
    const restart = stateRef.current !== null;
    stateRef.current = {
      phase: initialPhase,
      start: point,
      current: point,
      modifiers,
      scratch,
    };
    bumpPhase(initialPhase);
    if (!restart) opts.onGestureStart?.();
    opts.onStart?.(buildCtx());
  }, [buildCtx, bumpPhase, optsRef]);

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
        if (stateRef.current !== s) return true;
      }
    }
    opts.onMove?.(buildCtx());
    return true;
  }, [buildCtx, bumpPhase, optsRef]);

  const end = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (!s) return;
    const endCtx = Object.assign(ctxOf(s), { wasSubThreshold: s.phase === 'pending' });
    // Closed before `onEnd` runs, so a `cancel()` from it is a no-op and a
    // `start()` from it opens a gesture of its own that outlives this one.
    stateRef.current = null;
    let committed = false;
    try {
      const r = opts.onEnd?.(endCtx);
      committed = r !== false;
    } finally {
      if (!stateRef.current) bumpPhase('idle');
      opts.onGestureEnd?.(committed);
    }
  }, [bumpPhase, optsRef]);

  const cancel = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (!s) return;
    stateRef.current = null;
    try {
      opts.onCancel?.(ctxOf(s));
    } finally {
      if (!stateRef.current) bumpPhase('idle');
      opts.onGestureEnd?.(false);
    }
  }, [bumpPhase, optsRef]);

  useEffect(() => cancel, [cancel]);

  return useMemo<DragGestureController>(() => ({
    start, move, end, cancel,
    get phase() { return phaseRef.current; },
    get isActive() { return phaseRef.current !== 'idle'; },
  }), [start, move, end, cancel]);
}
