import type { CLOCK_RATES } from './rates';

/**
 * What a caller declares to get a clock: how long a pass runs, how many
 * passes, and how it opens. Shaped like a blits voice spec.
 */
export interface ClockSpec {
  /** ms per pass. Omitted, the run never ends. `Clock.duration` changes
   *  it later, for a run whose length follows its content. */
  duration?: number;
  /** Passes: `true` endless, `false` one, `n` that many. Default `false`. */
  loop?: boolean | number;
  /** The rate it opens at; `0`, the default, opens paused. */
  rate?: number;
  /** Where a new run opens, in ms, clamped to the run; `'end'` is the end of
   *  its last pass. Default `0`. A reopened run opens where it stood. */
  start?: number | 'end';
  /** The time `elapsed` 0 is shown as, in ms. Display only: nothing in the
   *  run moves with it. Default `0`. */
  origin?: number;
  /** The unsigned speed a transport plays a paused clock at. Default `|rate|`,
   *  or `1` for a clock that opens paused. */
  speed?: number;
  /** The speeds a transport offers, unsigned. Default {@link CLOCK_RATES}. */
  rates?: readonly number[];
  /** `false` for a clock whose state is built up by running, so time can
   *  only move by running: no seek and no negative rate. Default `true`. */
  seekable?: boolean;
  /** ms a frame when the host runs the clock forward with nothing shown, which
   *  is how a still of a clock that is not seekable reaches its time. Omitted,
   *  such a still stays where the clock opens. */
  step?: number;
  /** Makes a blits mix, which then plays on this clock: its mix time is kept
   *  at `elapsed`, synced forward and sought back, so scrubbing and reverse
   *  reach it. Give it `history` with a `tape` reaching back over the whole
   *  run, or a seek past it throws. Leave the mix's own `rate` alone; the
   *  clock's is the one that plays. */
  mix?: () => ClockedMix;
}

/** What a clock needs of a blits `Mix`. */
export interface ClockedMix {
  sync(timestamp: number): void;
  seek(time: number): void;
  readonly now: number;
}

/**
 * A run of time. A position (`elapsed`) moved by a signed `rate`, synced by a
 * frame loop once a frame. Named after blits' owner handle and `Ticked`, so a
 * blits ticker can drive one and blits voices can play under it.
 */
export interface Clock {
  /** ms the run has played, rate applied, counted across passes. */
  readonly elapsed: number;
  /** Which pass `elapsed` falls in, 0 first; the last once the run is over. */
  readonly pass: number;
  /** How far through its pass, 0 to 1; 1 once the run is over. 0 with no duration. */
  readonly phase: number;
  /** ms per pass; `Infinity` for a run that never ends. A write keeps `pass`
   *  and `phase`, so the playhead holds its place in the content. */
  duration: number;
  /** The time `elapsed` 0 is shown as; display only. */
  readonly origin: number;
  /** The unsigned speed a transport plays a paused clock at. */
  readonly speed: number;
  /** The speeds a transport offers, unsigned and ascending. */
  readonly rates: readonly number[];
  /** Whether `seek` and a negative `rate` are allowed. */
  readonly seekable: boolean;
  /** A finite run has played to its end. */
  readonly ended: boolean;
  /** Signed: 0 pauses and a negative rate plays backward. A write changes speed
   *  at once and replaces any ramp. */
  rate: number;
  /** Passes, as `ClockSpec.loop`. */
  loop: boolean | number;
  /** Move `rate` to `to` linearly over `over` real ms; position stays continuous. */
  ramp(to: number, over: number): void;
  /** Move to `elapsed` ms from the start, clamped to the run. Never runs state
   *  forward to meet it. Throws on a clock that is not seekable. A time on the
   *  line between two passes is the start of the later one; `'end'` stands at
   *  the end of the earlier, `phase` 1, until the clock next moves. */
  seek(elapsed: number, line?: 'start' | 'end'): void;
  /** The frame loop reports the time, once a frame. */
  sync(timestamp: number): void;
  /** The time between now and the next sync does not count. */
  rebase(): void;
  /** Another frame would change nothing: paused, no ramp, nothing changed since
   *  the last sync. */
  readonly inert: boolean;
  /** Called when a change needs frames again, once until the next sync. */
  onWake(fn: () => void): () => void;
  /** Called on a rate, seek or loop change, and when the run ends; never per frame. */
  subscribe(fn: () => void): () => void;
}

/** Where a clock stood, as a record keeps it. */
export interface ClockPosition {
  elapsed: number;
  rate: number;
  /** Absent when the clock still ran at its declared duration. */
  duration?: number;
  /** Absent when the clock still showed its declared origin. */
  origin?: number;
  /** It stood at the end of a pass another follows, as `seek(…, 'end')` leaves it. */
  passEnd?: true;
}

/** A clock, and what its host does with it. */
export interface ClockHandle {
  clock: Clock;
  /** The mix `ClockSpec.mix` made, playing on `clock`. */
  mix: ClockedMix | null;
  /** `ClockSpec.step`. */
  step?: number | undefined;
  /** Back to where it opened, at the declared rate — a Reset,
   *  allowed on a clock that is not seekable. */
  reset(): void;
  /** Takes up `spec`'s `duration`, `origin`, `loop` and `speed`. The shown
   *  time (`origin + elapsed`) is kept and clamped to the new run; play state
   *  and rate are left alone. Notifies like a seek. Unlike assigning
   *  `duration`, this does not keep `phase`. */
  declare(spec: ClockSpec): void;
  /** Replaces the declared `duration` and `origin` with `span`'s, where it
   *  gives them, until called with `null`; a later `declare` changes what lies
   *  under it, not the override. Keeps the shown time, clamped, like `declare`. */
  override(span: { duration?: number; origin?: number } | null): void;
  /** Called after each sync that moved the clock or followed a change. */
  onFrame(fn: (elapsed: number, pass: number) => void): () => void;
}
