/**
 * How `useVisibleRaf` schedules one loop's frame, and where that frame falls
 * among the other loops' in one animation frame. An update-phase loop's frame
 * runs ahead of every paint loop's on the same clock, and a paint loop asked
 * for from inside an update's frame runs right after it, so what an update
 * writes is painted the frame it is written.
 */
import { useCallback, useRef } from 'react';
import type { VisibleRaf, VisibleRafOptions } from './useVisibleRaf';

type FrameClock = (cb: FrameRequestCallback) => number;

/** A loop with a frame scheduled that another loop's frame may run early, in the same animation frame. */
interface DueFrame {
  clock: FrameClock;
  run(time: number): void;
}
/** Update loops with a frame scheduled: a paint loop runs them before its own frame. */
const dueUpdates = new Set<DueFrame>();
/** Paint loops an update loop's frame asked for: run after it, not an animation frame later. */
const duePaints = new Set<DueFrame>();
/** The clock of the update loop whose frame is running, if any. */
let updating: FrameClock | null = null;

/** Run every loop in `due` scheduled on `clock`, at `time`. One that throws is
 *  reported as its own animation frame's throw would be, and the rest still run. */
function runDue(due: Set<DueFrame>, clock: FrameClock, time: number): void {
  if (due.size === 0) return;
  for (const d of [...due]) {
    if (d.clock !== clock) continue;
    try {
      d.run(time);
    } catch (err) {
      queueMicrotask(() => { throw err; });
    }
  }
}

/** Run an update loop's frame, then the paint loops it asked for. */
function runUpdate(clock: FrameClock, time: number, frame: () => void): void {
  const outer = updating;
  updating = clock;
  try {
    frame();
  } finally {
    updating = outer;
  }
  if (outer === null) runDue(duePaints, clock, time);
}

/** What a scheduled frame reads of its loop. */
export interface ScheduledFrameArgs {
  frameRef: { readonly current: (time: number, loop: VisibleRaf) => void };
  optsRef: { readonly current: VisibleRafOptions };
  handleRef: { readonly current: VisibleRaf | null };
  aliveRef: { readonly current: boolean };
  /** Whether a frame is asked for; the frame clears it as it runs. */
  pendingRef: { current: boolean };
  isVisible: () => boolean;
  /** Suspends the loop: found hidden with no event to say so. */
  suspendRef: { readonly current: () => void };
}

/** One loop's frame: scheduled on its clock, run there or early by another loop's, and canceled. */
export function useScheduledFrame(args: ScheduledFrameArgs): { scheduleRaf: () => void; cancelRaf: () => void } {
  const { frameRef, optsRef, handleRef, aliveRef, pendingRef, isVisible, suspendRef } = args;
  const rafRef = useRef<number | null>(null);
  /** This loop's entry in `dueUpdates` or `duePaints`, while it has a frame scheduled there. */
  const dueRef = useRef<{ set: Set<DueFrame>; entry: DueFrame } | null>(null);
  /** The time of the frame it last ran: a paint loop later in that frame must not run an update again. */
  const ranAtRef = useRef<number | null>(null);

  const leaveDue = useCallback(() => {
    dueRef.current?.set.delete(dueRef.current.entry);
    dueRef.current = null;
  }, []);

  const cancelRaf = useCallback(() => {
    leaveDue();
    if (rafRef.current === null) return;
    (optsRef.current.cancelFrame ?? cancelAnimationFrame)(rafRef.current);
    rafRef.current = null;
  }, [optsRef, leaveDue]);

  const scheduleRaf = useCallback(() => {
    if (rafRef.current !== null || !aliveRef.current) return;
    const clock = optsRef.current.requestFrame ?? requestAnimationFrame;
    const update = optsRef.current.phase === 'update';
    let handle: number | null = null;
    /** The frame, from its own animation frame or run early by another loop's (`early`). */
    const fire = (time: number, early: boolean): void => {
      // An update runs once an animation frame, however many loops would run it.
      if (early && update && ranAtRef.current === time) return;
      // A frame run early, or canceled, whose callback a clock still calls.
      if (!early && handle !== null && rafRef.current !== handle) return;
      leaveDue();
      // Run early, its own frame is dropped; the handle stays held below so requests still coalesce.
      if (early && rafRef.current !== null) (optsRef.current.cancelFrame ?? cancelAnimationFrame)(rafRef.current);
      if (!aliveRef.current || !pendingRef.current) { rafRef.current = null; return; }
      // Hidden with no event to say so (the escape hatch lifted while hidden): suspend, so a return re-arms it.
      if (!isVisible()) { rafRef.current = null; suspendRef.current(); return; }
      // Still held while updates run, so one asking this loop for a frame joins this one.
      if (!update) runDue(dueUpdates, clock, time);
      // Released before the frame runs, so a `request()` issued from inside it
      // schedules the next one instead of being swallowed.
      rafRef.current = null;
      if (!pendingRef.current) return;
      pendingRef.current = false;
      ranAtRef.current = time;
      const run = (): void => { frameRef.current(time, handleRef.current!); };
      if (update) runUpdate(clock, time, run);
      else run();
    };
    handle = clock((time) => fire(time, false));
    rafRef.current = handle;
    const set = update ? dueUpdates : updating === clock ? duePaints : null;
    if (set) {
      const entry = { clock, run: (time: number) => fire(time, true) };
      set.add(entry);
      dueRef.current = { set, entry };
    }
  }, [frameRef, optsRef, handleRef, aliveRef, pendingRef, isVisible, suspendRef, leaveDue]);

  return { scheduleRaf, cancelRaf };
}
