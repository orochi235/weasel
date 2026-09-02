import type { AnimationHandle, EasingSpec, Interpolate, InterpolatorFactory } from '../types';

/** One keyframe. `easing` shapes the approach INTO this key from the previous
 *  one, so the first key's easing is never consulted. */
export interface Keyframe<T> {
  /** Time within the track's timeline, in ms. */
  t: number;
  value: T;
  /** A function, the name of a built-in, or cubic-bezier control points. */
  easing?: EasingSpec;
}

/** A track sampled as a pure function of the playhead. Scrubbing one is free
 *  and order-independent. */
export interface SampledTrack<T> {
  kind: 'sampled';
  label?: string;
  /** Sorted ascending by `t`. `sampleTrack` assumes this and does not sort. */
  keys: Keyframe<T>[];
  /** Required when T is not `number`; defaults to numeric lerp otherwise. */
  interpolate?: Interpolate<T>;
  /** Built once per segment and cached. Takes precedence over `interpolate`. */
  interpolator?: InterpolatorFactory<T>;
  onTick: (value: T) => void;
}

/** A track of edge crossings. Fires only when the playhead advances forward
 *  under playback — never on `seek`. */
export interface EventTrack {
  kind: 'event';
  label?: string;
  /** Sorted ascending by `t`. `fire` is told how far behind the frame its edge
   *  was crossed, in ms — never negative, and measured against `duration` on
   *  the loop seam, where the outgoing lap's tail fires after the wrap. */
  events: { t: number; fire: (lateBy: number) => void }[];
}

/** A nested timeline, evaluated at `playhead - at`. Children are NOT registered
 *  with the animator separately; the parent evaluates them. */
export interface TimelineTrack {
  kind: 'timeline';
  label?: string;
  at: number;
  timeline: NestedTimeline;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Track = SampledTrack<any> | EventTrack | TimelineTrack;

/** What a child timeline may declare. The parent owns playback, so `loop`,
 *  `autoplay`, `onDone` and `cancelKey` have no meaning below the root. */
export interface NestedTimeline {
  tracks: Track[];
  /** Defaults to the largest end time across `tracks`. */
  duration?: number;
}

export interface TimelineOptions extends NestedTimeline {
  /** `true` loops forever, `n` loops n additional times. Default false. */
  loop?: boolean | number;
  /** Default true. When false the timeline registers but holds at t=0 until resumed. */
  autoplay?: boolean;
  onDone?: () => void;
  cancelKey?: string;
}

export interface TimelineHandle extends AnimationHandle {
  /** Move the playhead. Never fires event tracks, at any depth. */
  seek(t: number): void;
  /** Change the loop policy. `true` loops forever, `n` allows n more laps,
   *  `false` stops at `duration`. Sets policy only — a timeline already parked
   *  at `duration` does not restart, because `rearm` declines to revive one.
   *  Rewind it with `seek(0)` and `resume()` to play it again. */
  setLoop(loop: boolean | number): void;
  /** Current playhead in ms. */
  time(): number;
  duration(): number;
  tracks(): readonly Track[];
  /** Run `fn`, then recompute duration, drop cached interpolators, and notify.
   *  Every mutation must go through this — an edited keyframe otherwise keeps
   *  interpolating toward its old value with no visible error. */
  edit(fn: () => void): void;
  /** Notified after each `edit`. Returns an unsubscribe. */
  subscribe(cb: () => void): () => void;
}
