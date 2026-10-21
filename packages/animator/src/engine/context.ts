import type { AnimationHandle, AnimationInfo, AnimationKind } from '../types';
import type { TargetState } from '../target';
import type { Codec } from './codec';
import type { TargetBook } from './offsets';
import type { Waiting } from './wakes';

/** One row of the animator's table. */
export interface ActiveAnimation extends Waiting {
  id: number;
  kind: AnimationKind;
  cancelKey?: string;
  label?: string;
  /** The target it moves, where it has one. */
  target?: TargetState;
  /** Built the first time something reports on this entry, then shared. */
  info?: AnimationInfo;
  /** 0–1 where the animation has an end to measure against. */
  progress?(virtualNow: number): number;
  /** Its `end` is reported, though the entry stays on the table until the
   *  frame's ticks are done. */
  ended?: boolean;
  /** It changes nothing from one frame to the next, so the frame loop need not run for it. */
  idle?: boolean;
  paused: boolean;
  timeScale: number;
  /** Its own clock, in virtual ms, as it stood when the animator's clock read `anchor`. Between
   *  the two it runs at its own rate, so no frame has to advance it. */
  base: number;
  anchor: number;
  /** Counts registrations: a frame ticks in this order. */
  seq: number;
  /** Where its clock starts, in virtual ms: its end, for one started there to play backward.
   *  Default 0. */
  startAt?: number;
  /** Ticked every frame for playing backward, where it would otherwise wait for its `due`. */
  rewinding: boolean;
  /** Returns true when finished. Called once per frame with the current
   *  virtual-ms timestamp and the effective scale it advanced at this frame. */
  tick(virtualNow: number, scale: number): boolean;
  /** Where it has nothing to do each frame: the time on its own clock, in virtual ms, that
   *  `tick` is first called at. It is called every frame from then until it finishes.
   *  `Infinity` for one that never needs a tick. */
  due?: number;
  /** Called when the animation is canceled. Skips onDone. */
  onCancel?(): void;
  /** Called when its pause state or time scale is set, by handle or by key, and when the
   *  animator turns direction. `rate` is what its voices play at: 0 while paused, below 0
   *  backward. */
  onRate?(paused: boolean, timeScale: number, rate: number): void;
  /** Its velocity, where that is not its one voice's: a spring on a target runs up to two. */
  velocity?(): number[];
}

export type AnimationSeed =
  Omit<ActiveAnimation, 'paused' | 'timeScale' | 'base' | 'anchor' | 'seq' | 'rewinding' | keyof Waiting>
  & {
    /** Registers under an existing `cancelKey` without canceling whoever
     *  holds it. For an animation re-registering itself — a revived
     *  timeline — which is not a new claim on the key. */
    keepExisting?: boolean;
  };

/** What the animator hands each primitive it builds. */
export interface AnimationContext {
  readonly codec: Codec;
  readonly targets: TargetBook;
  nextId(): number;
  /** Whether an animation starting now starts at its end, to play backward: a loop run back
   *  is starting the pass before. One with no end starts at its start all the same. */
  atEnd(): boolean;
  /** Runs `start`, with `atEnd` answering `end` for whatever it starts. */
  starting<T>(end: boolean, start: () => T): T;
  /** Seeds the codec's clock where `register` seeds a call's, so both charge the same wait. */
  seedClock(): void;
  register(seed: AnimationSeed): AnimationHandle;
  /** Whether `id` is still on the table. */
  has(id: number): boolean;
  /** Leaves `id` unticked until its clock has run `ms` more, for one whose `tick` has nothing
   *  to do before then. From then it is ticked every frame, as past its `due`. */
  defer(id: number, ms: number): void;
  /** Reports `id` as finished, ahead of its `onDone`. */
  reportEnd(id: number): void;
  /** Takes `id` off the table as finished, for one that ends outside its own tick. */
  finish(id: number): void;
  /** Says a voice on `target` reads something that changed outside the frame's own reading. It
   *  is read again once the frame's ticks are done; with `now`, or between frames, at once. */
  touch(target: TargetState, now?: boolean): void;
  /** Asks for a frame, where one is not running: something it shows has changed. */
  wake(): void;
  /** True once the host has unmounted; logs the first time. */
  tripwire(): boolean;
  /** Retires whoever holds `key` as interrupted by `by`, ahead of `by`'s own registration. */
  interrupt(key: string, by: AnimationSeed): void;
  /** The summed velocity of the animations holding `key` on `target`; null where none does. */
  velocityUnder(key: string, target: TargetState): number[] | null;
}
