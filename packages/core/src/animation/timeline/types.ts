import type { AnimationHandle, EasingFn, Interpolate, InterpolatorFactory } from '../types';

/** One keyframe. `easing` shapes the approach INTO this key from the previous
 *  one, so the first key's easing is never consulted. */
export interface Keyframe<T> {
  /** Time within the track's timeline, in ms. */
  t: number;
  value: T;
  easing?: EasingFn;
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
  /** Sorted ascending by `t`. */
  events: { t: number; fire: () => void }[];
}

/** A nested timeline, evaluated at `playhead - at`. Children are NOT registered
 *  with the animator separately; the parent evaluates them. */
export interface TimelineTrack {
  kind: 'timeline';
  label?: string;
  at: number;
  timeline: TimelineOptions;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Track = SampledTrack<any> | EventTrack | TimelineTrack;

export interface TimelineOptions {
  tracks: Track[];
  /** Defaults to the largest end time across `tracks`. */
  duration?: number;
  /** `true` loops forever, `n` loops n additional times. Default false. */
  loop?: boolean | number;
  /** Default true. When false the timeline registers but holds at t=0 until resumed. */
  autoplay?: boolean;
  onDone?: () => void;
  cancelKey?: string;
}

export interface TimelineHandle extends AnimationHandle {
  /** Move the playhead. Event cursors advance without firing, recursively. */
  seek(t: number): void;
  /** Current playhead in ms. */
  time(): number;
  duration(): number;
  tracks(): readonly Track[];
  /** Run `fn`, then bump the version, recompute duration, and notify. Every
   *  mutation must go through this — cached interpolators key on the version. */
  edit(fn: () => void): void;
  /** Notified after each `edit`. Returns an unsubscribe. */
  subscribe(cb: () => void): () => void;
}
