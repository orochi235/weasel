import type { AnimationSeed } from './engine/context';
import type { AnimationHandle } from './types';

/**
 * Lets a composite (loop / stagger) sit in the animator's id table without
 * being a real animation: its tick never completes, so only `cancel()` or
 * `finish()` removes it. The owning composite installs `setOnCancel` to tear
 * down its children when an external cancel fires.
 *
 * Not part of the public Animator surface.
 */
export interface Supervisor {
  id: number;
  cancel(): void;
  pause(): void;
  resume(): void;
  setTimeScale(s: number): void;
  timeScale(): number;
  isPaused(): boolean;
  /** The rate its clock runs at, the animator's own included: below 0 while it plays backward. */
  rate(): number;
  setOnCancel(cb: () => void): void;
  /** `cb` hears every pause, resume, and time scale set on the entry, by its
   *  handle or by `cancelKey`, so the composite can pass it to its children. */
  setOnRate(cb: (paused: boolean, timeScale: number) => void): void;
  /** `cb` hears the entry's virtual time once a frame, after every animation
   *  has ticked: what it starts is started outside the tick, as a caller's
   *  own code would start it. */
  setOnFrame(cb: (virtualNow: number) => void): void;
  /** Retire the entry because the composite completed on its own. Unlike
   *  `cancel`, skips the `setOnCancel` callback and reports an `end`. */
  finish(): void;
  cancelKey?: string;
}

/** What names a supervisor's entry in the animator's table and its events. */
export interface SupervisorOptions {
  kind: 'loop' | 'tweenLoop' | 'stagger' | 'keepAlive';
  cancelKey?: string;
  label?: string;
}

export type SupervisorFactory = (opts: SupervisorOptions) => Supervisor;

/** What {@link supervisors} needs of the animator. */
export interface SupervisorHost {
  nextId(): number;
  register(seed: AnimationSeed): AnimationHandle;
  /** Takes an entry off the table as finished. */
  finish(id: number): void;
  /** Runs `cb` once this frame's ticks are done. */
  afterTicks(cb: () => void): void;
  /** The rate entry `id`'s clock runs at; 0 for one that has left. */
  rateOf(id: number): number;
}

/** Makes the animator's supervisor factory: each is a registered animation whose tick never
 *  finishes, so loop and stagger sit in the id table and answer `cancel`, `cancelKey` and
 *  `isActive`. */
export function supervisors(host: SupervisorHost): SupervisorFactory {
  return ({ kind, cancelKey, label }) => {
    const id = host.nextId();
    let onCancelCb: (() => void) | undefined;
    let onRateCb: ((paused: boolean, timeScale: number) => void) | undefined;
    let onFrameCb: ((virtualNow: number) => void) | undefined;
    const base = host.register({
      id,
      kind,
      cancelKey,
      label,
      tick: (virtualNow) => {
        if (onFrameCb) host.afterTicks(() => onFrameCb?.(virtualNow));
        return false;
      },
      onCancel: () => onCancelCb?.(),
      onRate: (paused, timeScale) => onRateCb?.(paused, timeScale),
    });
    return {
      id: base.id,
      cancel: base.cancel,
      pause: base.pause,
      resume: base.resume,
      setTimeScale: base.setTimeScale,
      timeScale: base.timeScale,
      isPaused: base.isPaused,
      rate: () => host.rateOf(id),
      setOnCancel: (cb) => { onCancelCb = cb; },
      setOnRate: (cb) => { onRateCb = cb; },
      setOnFrame: (cb) => { onFrameCb = cb; },
      finish: () => host.finish(id),
      cancelKey,
    };
  };
}

/**
 * Subscribe to "this animation id finished or was canceled and is no longer
 * in the registry." Returns an unsubscribe. Fires at most once, and at once
 * for an id that has already left. Fires for both natural completion and
 * external cancel.
 */
export type WatchCompletion = (id: number, cb: () => void) => () => void;
