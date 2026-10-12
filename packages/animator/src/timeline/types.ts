import type { Target } from '../target';
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
 *  and order-independent. Give it `onTick`, a `target`, or both. */
export interface SampledTrack<T> {
  kind: 'sampled';
  label?: string;
  /** Sorted ascending by `t`. Of keys sharing a time, the last in the array is
   *  the value at exactly that time. */
  keys: Keyframe<T>[];
  /** Required unless the track has a `target`, or every key's value is a number, a number
   *  array or a plain object of numbers, all of one shape; those are lerped field by field. */
  interpolate?: Interpolate<T>;
  /** Built once per segment and cached. Takes precedence over `interpolate`. */
  interpolator?: InterpolatorFactory<T>;
  /** Told each sampled value, at any playhead. Optional beside a `target`. */
  onTick?: (value: T) => void;
  /**
   * A value for the track to move. While the playhead is within the track's keys, the target
   * shows the sampled value in place of its committed one, as under `animator.hold`, with
   * what an animation on the target shows apart from its destination added on top. Once the playhead is past the last key, or the
   * timeline finishes or is canceled, the target keeps the value it was showing; before the
   * first key the track leaves the target alone.
   *
   * With no `interpolate` or `interpolator`, the track is sampled in the target's axes: each
   * axis lerps on its own, an angle axis the short way round from the key before, and every
   * sample is a value the axes built, a key's own included.
   */
  target?: Target<T>;
  /** What `target` goes by in a clip, for `toClip` to write and a `ClipBinder` to resolve.
   *  A target has no name of its own. */
  targetName?: string;
  /** What `interpolate` goes by in a clip, as `targetName` is for `target`. */
  interpolateName?: string;
  /** The track's share among the target's holds, as `HoldOptions.weight`. Default 1. */
  weight?: number | (() => number);
  /** What a function `weight` goes by in a clip, as `targetName` is for `target`. */
  weightName?: string;
  /** The axes of the target the track holds, as `HoldOptions.axes`. Default: every axis. */
  axes?: readonly number[];
  /** What `axes` goes by in a clip, where its target has names for them: a rig's joints.
   *  `toClip` writes these in place of the numbers, and a `ClipBinder` turns them back. */
  axisNames?: readonly string[];
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

/** One entry on an `EventTrack`. Give it `fire`, `book`, or both. */
export interface TimelineEvent {
  /** Time within the track's timeline, in ms. */
  t: number;
  /** What the event goes by in a clip: a `ClipBinder` turns it and `data` into `fire` and
   *  `book`. */
  name?: string;
  /** Carried with `name` into a clip. Anything JSON holds. */
  data?: unknown;
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
 *  fires nor books the span it skips. An event the playhead is sitting on,
 *  after a seek or at the start, fires when playback next advances from there
 *  and never while paused. */
export interface EventTrack {
  kind: 'event';
  label?: string;
  /** Sorted ascending by `t`. */
  events: TimelineEvent[];
}

/** How a timeline books its events against an outside clock. */
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

/** Any track a timeline can hold. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Track = SampledTrack<any> | EventTrack | TimelineTrack;

/** What a child timeline may declare. The parent owns playback, so `loop`,
 *  `autoplay`, `onDone` and `cancelKey` have no meaning below the root. */
export interface NestedTimeline {
  tracks: Track[];
  /** Defaults to the largest end time across `tracks`. */
  duration?: number;
}

/** What `animator.timeline` takes: a root timeline, which owns playback. */
export interface TimelineOptions extends NestedTimeline {
  /** `true` loops forever, `n` loops n additional times. Default false. */
  loop?: boolean | number;
  /** Default true. When false the timeline registers but holds at t=0 until resumed. */
  autoplay?: boolean;
  /** Called when playback reaches the end of its last lap. */
  onDone?: () => void;
  /** Any new animation passed the same `cancelKey` cancels this one. */
  cancelKey?: string;
  /** Names this timeline in `animator.watch` events and `animator.live()`. */
  label?: string;
  /** Books each event's `book` against a clock the timeline does not own, so a
   *  consumer on that clock lands it at its true sub-frame time. The frame
   *  clock's mapping onto it is smoothed each frame and resynced on a jump. */
  booking?: EventBooking;
}

/** What `animator.timeline` returns: playback control plus live editing. */
export interface TimelineHandle extends AnimationHandle {
  /** Move the playhead. Fires no event itself, at any depth; an event exactly
   *  at `t` fires when playback next advances. Sampled tracks are sampled at
   *  `t` at once, so a target they hold reads the new value before the next frame. */
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
  /** Run `fn`, then recompute duration, drop cached interpolators, sample the
   *  tracks again where the playhead stands, and notify.
   *  Every mutation must go through this — an edited keyframe otherwise keeps
   *  interpolating toward its old value with no visible error. */
  edit(fn: () => void): void;
  /** Notified after each `edit`. Returns an unsubscribe. */
  subscribe(cb: () => void): () => void;
  /** Notified when playback changes other than by time passing: `pause`,
   *  `resume`, `seek`, `setTimeScale`, `setLoop`, a cancel, and the playhead
   *  reaching the end. What a view of the playhead listens to, so a change
   *  made elsewhere reaches it. Returns an unsubscribe. */
  subscribePlayback(cb: () => void): () => void;
}
