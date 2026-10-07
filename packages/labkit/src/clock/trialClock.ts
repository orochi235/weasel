/**
 * What an instrument declares to get a clock: how long a pass runs, how many
 * passes, and how it opens. Shaped like a blits voice spec.
 */
export interface ClockCapability {
  /** ms per pass. Omitted, the run never ends. */
  duration?: number;
  /** Passes: `true` endless, `false` one, `n` that many. Default `false`. */
  loop?: boolean | number;
  /** The rate it opens at; `0`, the default, opens paused. */
  rate?: number;
  /** `false` for an instrument whose state is built up by running, so time can
   *  only move by running: no seek and no negative rate. Default `true`. */
  seekable?: boolean;
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
  /** ms per pass, as declared; `Infinity` for a run that never ends. */
  readonly duration: number;
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

/** A clock, and what labkit alone does with it. */
export interface TrialClockHandle {
  clock: TrialClock;
  /** Back to 0 at the declared rate — the trial's Reset, allowed on a clock
   *  that is not seekable. */
  reset(): void;
  /** Called after each sync that moved the clock or followed a change. */
  onFrame(fn: (elapsed: number, pass: number) => void): () => void;
}

const passesOf = (loop: boolean | number): number =>
  loop === true ? Number.POSITIVE_INFINITY : loop === false ? 1 : Math.max(1, loop);

const checkRate = (rate: number, seekable: boolean): void => {
  if (!Number.isFinite(rate)) throw new RangeError(`labkit: a clock's rate is finite, not ${rate}`);
  if (rate < 0 && !seekable)
    throw new RangeError('labkit: a clock that is not seekable cannot run backward');
};

/** A trial's clock, opened from its declaration and, for a trial reopened,
 *  where it stood. */
export function createTrialClock(
  spec: ClockCapability,
  start?: { elapsed: number; rate: number },
): TrialClockHandle {
  const duration = spec.duration ?? Number.POSITIVE_INFINITY;
  const seekable = spec.seekable ?? true;
  const openRate = spec.rate ?? 0;
  checkRate(openRate, seekable);

  let loop = spec.loop ?? false;
  let span = duration * passesOf(loop);
  let rate = start ? start.rate : openRate;
  let elapsed = start ? Math.min(Math.max(0, start.elapsed), span) : 0;
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
    duration,
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
      elapsed = Math.min(Math.max(0, target), span);
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

  return {
    clock,
    reset() {
      elapsed = 0;
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
