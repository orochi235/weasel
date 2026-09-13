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

/** A clock that events are booked against, reading in ms. An `AudioEngine`
 *  from `@weasel-js/audio` is one. */
export interface TimelineClock {
  now(): number;
}

/** What `book` hands back so the booking can be retracted. A `VoiceHandle` from
 *  `@weasel-js/audio` is one. */
export interface EventBookingHandle {
  stop(): void;
}

export interface TimelineEvent {
  t: number;
  /** Runs on the frame that crosses the edge, told how far behind the frame it
   *  was crossed, in ms — never negative, and measured against `duration` on
   *  the loop seam, where the outgoing lap's tail fires after the wrap. */
  fire?: (lateBy: number) => void;
  /** Runs up to `booking.lookahead` before the edge on a timeline with a
   *  `booking`, once per crossing, with the `booking.clock` time the edge lands
   *  at — never earlier than that clock's `now()`. A returned handle is stopped
   *  if a pause, seek, rate change, loop change, edit or cancel invalidates the
   *  booking before the clock reaches `when`; the event is then booked again
   *  wherever playback next reaches it. A booking with no handle stands. */
  book?: (when: number) => EventBookingHandle | void;
}

/** A track of edge crossings, in forward playback only — a `seek` neither
 *  fires nor books the span it skips. */
export interface EventTrack {
  kind: 'event';
  label?: string;
  /** Sorted ascending by `t`. */
  events: TimelineEvent[];
}

export interface EventBooking {
  clock: TimelineClock;
  /** How far ahead of the playhead to book, in clock ms. Default 100. An event
   *  first reached later than this — after a frame longer than it — books late. */
  lookahead?: number;
  /** An event first reached more than this many clock ms after its edge is
   *  skipped instead of booked late. Default `Infinity`. */
  maxLate?: number;
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
  /** Books each event's `book` against a clock the timeline does not own, so a
   *  consumer on that clock lands it at its true sub-frame time. The frame
   *  clock's mapping onto it is smoothed each frame and resynced on a jump. */
  booking?: EventBooking;
}

export interface TimelineHandle extends AnimationHandle {
  /** Move the playhead. Never fires event tracks, at any depth. */
  seek(t: number): void;
  /** Change the loop policy. `true` loops forever, `n` allows n more laps,
   *  `false` stops at `duration`. Sets policy only — a timeline already parked
   *  at `duration` does not restart, because `rearm` declines to revive one.
   *  Rewind it with `seek(0)` and `resume()` to play it again. */
  setLoop(loop: boolean | number): void;
  /** The loop policy as it now stands: `true` endless, `false` stopping at
   *  `duration`, `n` for n laps still allowed. A finite count falls as laps
   *  are consumed, matching what `setLoop` takes. */
  loop(): boolean | number;
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
