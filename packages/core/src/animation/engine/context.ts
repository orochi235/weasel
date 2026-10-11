import type { AnimationHandle, AnimationInfo, AnimationKind } from '../types';
import type { TargetState } from '../target';
import type { Codec, Own } from './codec';
import type { TargetBook } from './offsets';

/** One row of the animator's table. */
export interface ActiveAnimation {
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
  virtualNow: number;
  lastRealNow: number | null;
  /** Returns true when finished. Called once per frame with the current
   *  virtual-ms timestamp and the effective scale it advanced at this frame. */
  tick(virtualNow: number, scale: number): boolean;
  /** Called when the animation is canceled. Skips onDone. */
  onCancel?(): void;
  /** Called when its pause state or time scale is set, by handle or by key. */
  onRate?(paused: boolean, timeScale: number): void;
}

export type AnimationSeed =
  Omit<ActiveAnimation, 'paused' | 'timeScale' | 'virtualNow' | 'lastRealNow'>
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
  /** Seeds the codec's clock where `register` seeds a call's, so both charge the same wait. */
  seedClock(): void;
  register(seed: AnimationSeed): AnimationHandle;
  /** Whether `id` is still on the table. */
  has(id: number): boolean;
  /** Reports `id` as finished, ahead of its `onDone`. */
  reportEnd(id: number): void;
  /** Takes `id` off the table as finished, for one that ends outside its own tick. */
  finish(id: number): void;
  /** Says a voice on `target` reads something that changed outside the frame's own reading. It
   *  is read again once the frame's ticks are done; with `now`, or between frames, at once. */
  touch(target: TargetState, now?: boolean): void;
  /** True once the host has unmounted; logs the first time. */
  tripwire(): boolean;
  /** Retires whoever holds `key` as interrupted by `by`, ahead of `by`'s own registration. */
  interrupt(key: string, by: AnimationSeed): void;
  /** The motion of the animation holding `key` on `target`, where there is one. */
  holder(key: string, target: TargetState): Own | undefined;
}
