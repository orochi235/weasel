import { TRANSPORT_RATES } from '../passthrough/weasel-ui';

/**
 * What an instrument declares to get a clock: how long a pass runs, how many
 * passes, and how it opens. Shaped like a blits voice spec.
 */
export interface ClockCapability {
  /** ms per pass. Omitted, the run never ends. `TrialClock.duration` changes
   *  it later, for a run whose length follows its content. */
  duration?: number;
  /** Passes: `true` endless, `false` one, `n` that many. Default `false`. */
  loop?: boolean | number;
  /** The rate it opens at; `0`, the default, opens paused. */
  rate?: number;
  /** Where a new run opens, in ms, clamped to the run; `'end'` is the end of
   *  its last pass. Default `0`. A reopened trial opens where it stood. */
  start?: number | 'end';
  /** The speeds a transport offers, unsigned. Default `TRANSPORT_RATES`. */
  rates?: readonly number[];
  /** `false` for an instrument whose state is built up by running, so time can
   *  only move by running: no seek and no negative rate. Default `true`. */
  seekable?: boolean;
  /** Makes the trial's blits mix, which then plays on this clock: its mix
   *  time is kept at `elapsed`, synced forward and sought back, so scrubbing
   *  and reverse reach it. Give it `history` with a `tape` reaching back over
   *  the whole run, or a seek past it throws. Leave the mix's own `rate`
   *  alone; the clock's is the one that plays. Read it with `useTrialMix`. */
  mix?: () => ClockedMix;
}

/** What a trial clock needs of a blits `Mix`. */
export interface ClockedMix {
  sync(timestamp: number): void;
  seek(time: number): void;
  readonly now: number;
}

/**
 * A trial's time. A position (`elapsed`) moved by a signed `rate`, synced by
 * the lab's frame loop once a frame. Named after blits' owner handle and
 * `Ticked`, so a blits ticker can drive one and blits voices can play under it.
 */
export interface TrialClock {
  /** ms the trial has played, rate applied, counted across passes. */
  readonly elapsed: number;
  /** Which pass `elapsed` falls in, 0 first; the last once the run is over. */
  readonly pass: number;
  /** How far through its pass, 0 to 1; 1 once the run is over. 0 with no duration. */
  readonly phase: number;
  /** ms per pass; `Infinity` for a run that never ends. A write keeps `pass`
   *  and `phase`, so the playhead holds its place in the content. */
  duration: number;
  /** The speeds a transport offers, unsigned and ascending. */
  readonly rates: readonly number[];
  /** Whether `seek` and a negative `rate` are allowed. */
  readonly seekable: boolean;
  /** A finite run has played to its end. */
  readonly ended: boolean;
  /** Signed: 0 pauses and a negative rate plays backward. A write changes speed
   *  at once and replaces any ramp. */
  rate: number;
  /** Passes, as `ClockCapability.loop`. */
  loop: boolean | number;
  /** Move `rate` to `to` linearly over `over` real ms; position stays continuous. */
  ramp(to: number, over: number): void;
  /** Move to `elapsed` ms from the start, clamped to the run. Never runs state
   *  forward to meet it. Throws on a clock that is not seekable. */
  seek(elapsed: number): void;
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

/** Where a clock stood, as a trial record keeps it. */
export interface ClockPosition {
  elapsed: number;
  rate: number;
  /** Absent when the clock still ran at its declared duration. */
  duration?: number;
}

/** A clock, and what labkit alone does with it. */
export interface TrialClockHandle {
  clock: TrialClock;
  /** The mix `ClockCapability.mix` made, playing on `clock`. */
  mix: ClockedMix | null;
  /** Back to where it opened, at the declared rate — the trial's Reset,
   *  allowed on a clock that is not seekable. */
  reset(): void;
  /** Called after each sync that moved the clock or followed a change. */
  onFrame(fn: (elapsed: number, pass: number) => void): () => void;
}

/** Where `clock` stands, for a record to reopen it at; `declared` is the
 *  duration its capability gave. */
export function clockPosition(clock: TrialClock, declared: number | undefined): ClockPosition {
  const duration = declared ?? Number.POSITIVE_INFINITY;
  return {
    elapsed: clock.elapsed,
    rate: clock.rate,
    ...(clock.duration !== duration ? { duration: clock.duration } : {}),
  };
}

const passesOf = (loop: boolean | number): number =>
  loop === true ? Number.POSITIVE_INFINITY : loop === false ? 1 : Math.max(1, loop);

const checkDuration = (duration: number): void => {
  if (!(duration > 0))
    throw new RangeError(`labkit: a clock's duration is positive, not ${duration}`);
};

const checkRate = (rate: number, seekable: boolean): void => {
  if (!Number.isFinite(rate)) throw new RangeError(`labkit: a clock's rate is finite, not ${rate}`);
  if (rate < 0 && !seekable)
    throw new RangeError('labkit: a clock that is not seekable cannot run backward');
};

/** A trial's clock, opened from its declaration and, for a trial reopened,
 *  where it stood. */
export function createTrialClock(spec: ClockCapability, start?: ClockPosition): TrialClockHandle {
  let duration = start?.duration ?? spec.duration ?? Number.POSITIVE_INFINITY;
  checkDuration(duration);
  const seekable = spec.seekable ?? true;
  const openRate = spec.rate ?? 0;
  checkRate(openRate, seekable);
  const rates = [...(spec.rates ?? TRANSPORT_RATES)].sort((a, b) => a - b);
  if (rates.length === 0 || rates.some((r) => !(r > 0) || !Number.isFinite(r)))
    throw new RangeError('labkit: a clock offers at least one rate, each finite and positive');

  let loop = spec.loop ?? false;
  let span = duration * passesOf(loop);
  const clamp = (ms: number): number => Math.min(Math.max(0, ms), span);
  const opening = (): number => {
    if (spec.start !== 'end') return clamp(spec.start ?? 0);
    if (!Number.isFinite(span))
      throw new RangeError("labkit: a run that never ends has no 'end' to start at");
    return span;
  };
  let rate = start ? start.rate : openRate;
  let elapsed = start ? clamp(start.elapsed) : opening();
  let ramp: { to: number; left: number } | null = null;
  let last = Number.NaN;
  /** Changed since the last sync, so the next one is due even when paused. */
  let changed = false;
  /** Inert as of the last sync: the next one only records the time. */
  let slept = false;
  let wakeFired = false;
  const wakes = new Set<() => void>();
  const subs = new Set<() => void>();
  const frames = new Set<(elapsed: number, pass: number) => void>();

  const mix = spec.mix?.() ?? null;
  // The mix's host clock: it only goes forward, by what the clock moved forward.
  let host = 0;
  const follow = (): void => {
    if (!mix) return;
    const ahead = elapsed - mix.now;
    if (ahead > 0) {
      host += ahead;
      mix.sync(host);
    } else if (ahead < 0) mix.seek(elapsed);
  };
  mix?.sync(host);

  const isInert = (): boolean => rate === 0 && ramp === null && !changed;
  const notify = (): void => {
    for (const fn of [...subs]) fn();
  };
  const change = (): void => {
    changed = true;
    if (wakeFired) return;
    wakeFired = true;
    for (const fn of [...wakes]) fn();
  };
  const passAt = (): number =>
    duration > 0 && Number.isFinite(duration)
      ? elapsed >= span
        ? passesOf(loop) - 1
        : Math.floor(elapsed / duration)
      : 0;
  const phaseAt = (): number =>
    duration > 0 && Number.isFinite(duration)
      ? elapsed >= span
        ? 1
        : (elapsed % duration) / duration
      : 0;

  /** ms of trial time over `dt` real ms, ramp included; settles the ramp. */
  const advance = (dt: number): number => {
    if (!ramp) return rate * dt;
    if (dt >= ramp.left) {
      const area = ((rate + ramp.to) / 2) * ramp.left + ramp.to * (dt - ramp.left);
      rate = ramp.to;
      ramp = null;
      notify();
      return area;
    }
    const next = rate + ((ramp.to - rate) * dt) / ramp.left;
    const area = ((rate + next) / 2) * dt;
    rate = next;
    ramp.left -= dt;
    return area;
  };

  const clock: TrialClock = {
    get elapsed() {
      return elapsed;
    },
    get pass() {
      return passAt();
    },
    get phase() {
      return phaseAt();
    },
    get duration() {
      return duration;
    },
    set duration(next: number) {
      checkDuration(next);
      if (next === duration) return;
      if (Number.isFinite(duration) && Number.isFinite(next)) {
        const ended = elapsed >= span;
        const at = passAt() + phaseAt();
        duration = next;
        span = duration * passesOf(loop);
        elapsed = ended ? span : clamp(at * duration);
      } else {
        duration = next;
        span = duration * passesOf(loop);
        elapsed = clamp(elapsed);
      }
      change();
      notify();
    },
    rates,
    seekable,
    get ended() {
      return Number.isFinite(span) && elapsed >= span;
    },
    get rate() {
      return rate;
    },
    set rate(next: number) {
      checkRate(next, seekable);
      rate = next;
      ramp = null;
      change();
      notify();
    },
    get loop() {
      return loop;
    },
    set loop(next: boolean | number) {
      loop = next;
      span = duration * passesOf(loop);
      elapsed = Math.min(elapsed, span);
      change();
      notify();
    },
    ramp(to, over) {
      checkRate(to, seekable);
      if (!(over > 0)) {
        clock.rate = to;
        return;
      }
      ramp = { to, left: over };
      change();
      notify();
    },
    seek(target) {
      if (!seekable) throw new Error('labkit: this clock is not seekable');
      elapsed = clamp(target);
      change();
      notify();
    },
    sync(timestamp) {
      const wasChanged = changed;
      const before = elapsed;
      if (!Number.isNaN(last) && !slept) {
        elapsed += advance(Math.max(0, timestamp - last));
        if (elapsed >= span && rate > 0) {
          elapsed = span;
          rate = 0;
          ramp = null;
          notify();
        } else if (elapsed <= 0 && rate < 0) {
          elapsed = 0;
          rate = 0;
          ramp = null;
          notify();
        }
      }
      last = timestamp;
      changed = false;
      wakeFired = false;
      slept = isInert();
      if (elapsed !== before || wasChanged) {
        follow();
        const pass = passAt();
        for (const fn of [...frames]) fn(elapsed, pass);
      }
    },
    rebase() {
      last = Number.NaN;
    },
    get inert() {
      return isInert();
    },
    onWake(fn) {
      wakes.add(fn);
      return () => {
        wakes.delete(fn);
      };
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };

  follow();

  return {
    clock,
    mix,
    reset() {
      elapsed = opening();
      rate = openRate;
      ramp = null;
      change();
      notify();
    },
    onFrame(fn) {
      frames.add(fn);
      return () => {
        frames.delete(fn);
      };
    },
  };
}
