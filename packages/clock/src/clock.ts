import { kit, mix as createMix, type Transport, transport as createTransport } from '@msb235/blits';
import { createHistory } from '@weasel-js/history';
import { createEmitter } from '@weasel-js/registry';
import { passesOf, placeOf } from './place';
import type { Clock, ClockHandle, ClockPosition, ClockSpec } from './types';
import { checkDuration, checkLoop, checkOrigin, checkRampTime, checkRate, checkSpeed, speedsOf } from './validate';

/** Where `clock` stands, for a record to reopen it at; `declared` is the
 *  duration its spec gave, and `declaredOrigin` the origin. */
export function clockPosition(
  clock: Clock,
  declared: number | undefined,
  declaredOrigin = 0,
): ClockPosition {
  const duration = declared ?? Number.POSITIVE_INFINITY;
  return {
    elapsed: clock.elapsed,
    rate: clock.rate,
    ...(clock.duration !== duration ? { duration: clock.duration } : {}),
    ...(clock.origin !== declaredOrigin ? { origin: clock.origin } : {}),
    ...(clock.phase === 1 && !clock.ended ? { passEnd: true as const } : {}),
  };
}

/** A clock's moving parts, read and written by the functions below. */
interface Run {
  duration: number;
  loop: boolean | number;
  span: number;
  origin: number;
  speed: number;
  /** The transport's rate; a write sets it at once. */
  rate: number;
  /** The transport's time; a write seeks it. */
  elapsed: number;
  edge: boolean;
  /** A ramp the transport is running, and the real ms left of it, for `ramping` and to put it back after a seek. */
  ramp: { to: number; left: number; over: number } | null;
  last: number;
  t: Transport;
  /** Changed since the last sync, so the next one is due even when paused. */
  changed: boolean;
  /** Inert as of the last sync: the next one only records the time. */
  slept: boolean;
  wakeFired: boolean;
}

interface Hub {
  wakes: ReturnType<typeof createEmitter>;
  subs: ReturnType<typeof createEmitter>;
  frames: ReturnType<typeof createEmitter<[elapsed: number, pass: number]>>;
  /** Where a new run opens. */
  opening: () => number;
}

const clamp = (run: Run, ms: number): number => Math.min(Math.max(0, ms), run.span);
const isInert = (run: Run): boolean => run.rate === 0 && run.ramp === null && !run.changed;
const passAt = (run: Run): number =>
  placeOf(run.elapsed, run.duration, passesOf(run.loop), run.edge).pass;
const phaseAt = (run: Run): number =>
  placeOf(run.elapsed, run.duration, passesOf(run.loop), run.edge).phase;
/** The speed a transport plays a paused clock at, when none is declared. */
/** The speed `spec` declares: its `speed`, else its `rate` unsigned, else 1. */
export const declaredSpeed = (spec: ClockSpec): number => spec.speed ?? (Math.abs(spec.rate ?? 0) || 1);

/** Which pass `elapsed` falls in and how far into it, in ms; a pass's end stands as its own. */
function passOf(run: Run): { pass: number; into: number } {
  const { pass } = placeOf(run.elapsed, run.duration, passesOf(run.loop), run.edge);
  return { pass, into: pass === 0 ? run.elapsed : run.elapsed - pass * run.duration };
}

/** Places `into` ms into pass `pass` of the run, the pass clamped to the run's last and
 *  `into` to the pass; `into` at the pass's end stands as that end, not the next pass's start. */
function placeIn(run: Run, pass: number, into: number): void {
  const last = Math.ceil(passesOf(run.loop)) - 1;
  const within = Math.min(Math.max(0, into), run.duration);
  const at = Math.min(pass, last);
  // A pass's end is written as the next pass's start, which is how `placeOf` finds the line. A sum from the later
  // half of a pass that rounds onto or past that line stands at its end.
  const line = (at + 1) * run.duration;
  const sum = at * run.duration + within;
  const end = within > 0 && (within === run.duration || (within > run.duration / 2 && sum >= line));
  // Far out a pass's start and the time into it sum past the double range; an endless run holds the largest time.
  run.elapsed = Math.min(Number.MAX_VALUE, clamp(run, end ? line : sum));
  run.edge = run.elapsed > 0 && end;
}

function change(run: Run, hub: Hub): void {
  run.changed = true;
  if (run.wakeFired) return;
  run.wakeFired = true;
  hub.wakes.emit();
}

function setDuration(run: Run, hub: Hub, next: number): void {
  checkDuration(next);
  if (next === run.duration) return;
  if (Number.isFinite(run.duration) && Number.isFinite(next)) {
    const ended = run.elapsed >= run.span;
    const pass = passAt(run);
    const phase = phaseAt(run);
    run.duration = next;
    run.span = run.duration * passesOf(run.loop);
    // Not `(pass + phase) * next`: far out, the sum rounds a phase near 1 up into the next pass.
    if (ended) run.elapsed = run.span;
    else placeIn(run, pass, phase * next);
  } else {
    run.duration = next;
    run.span = run.duration * passesOf(run.loop);
    run.elapsed = clamp(run, run.elapsed);
    run.edge = false;
  }
  change(run, hub);
  hub.subs.emit();
}

/** The four fields `declare` takes up, resolved. */
interface Declared {
  duration: number;
  origin: number;
  loop: boolean | number;
  speed: number;
}

/** A runtime replacement for the declared `duration` and `origin`; see `ClockHandle.override`. */
type SpanOverride = { duration?: number; origin?: number } | null;

function declaredOf(spec: ClockSpec): Declared {
  return {
    duration: spec.duration ?? Number.POSITIVE_INFINITY,
    origin: spec.origin ?? 0,
    loop: spec.loop ?? false,
    speed: declaredSpeed(spec),
  };
}

/** Takes up `declared` with `override` laid over it, keeping the pass and the
 *  shown time within it, clamped. */
function applyRun(run: Run, hub: Hub, declared: Declared, override: SpanOverride): void {
  const duration = override?.duration ?? declared.duration;
  const origin = override?.origin ?? declared.origin;
  checkDuration(duration);
  checkOrigin(origin);
  checkSpeed(declared.speed);
  checkLoop(declared.loop);
  const finite = Number.isFinite(run.duration) && Number.isFinite(duration);
  const { pass, into } = finite ? passOf(run) : { pass: 0, into: run.elapsed };
  // Moved by the change of origin alone, so an unchanged origin leaves the time within the pass exactly as it was.
  const within = into + (run.origin - origin);
  run.duration = duration;
  run.loop = declared.loop;
  run.span = duration * passesOf(run.loop);
  run.origin = origin;
  run.speed = declared.speed;
  if (Number.isFinite(duration)) placeIn(run, pass, within);
  else {
    run.elapsed = clamp(run, within);
    run.edge = false;
  }
  change(run, hub);
  hub.subs.emit();
}

/** Seeks the transport to `to`, then puts back the rate and ramp the seek reverted. A transport only
 *  seeks ahead under a rate that reaches the time, so ahead it plays at 1 for the seek. */
function seekTransport(run: Run, to: number): void {
  const t = run.t;
  if (Object.is(to, t.now)) return;
  const rate = t.rate;
  if (to > t.now) t.ramp(1, 0);
  t.seek(to);
  t.ramp(rate, 0);
  if (run.ramp) t.ramp(run.ramp.to, run.ramp.left);
}

/** Counts `dt` real ms off the ramp; settles it. */
function stepRampLeft(run: Run, hub: Hub, dt: number): void {
  const ramp = run.ramp;
  if (!ramp) return;
  ramp.left -= dt;
  if (ramp.left > 8 * Number.EPSILON * ramp.over) return;
  run.ramp = null;
  hub.subs.emit();
}

function syncTo(run: Run, hub: Hub, timestamp: number): void {
  if (!Number.isFinite(timestamp)) throw new RangeError(`a clock syncs to a finite time, not ${timestamp}`);
  const wasChanged = run.changed;
  const before = run.elapsed;
  const counts = !Number.isNaN(run.last) && !run.slept && timestamp >= run.last;
  // The transport counts host time between syncs; a gap that does not count is rebased out of it.
  if (!counts) run.t.rebase();
  run.t.sync(timestamp);
  if (counts) {
    stepRampLeft(run, hub, timestamp - run.last);
    const moved = run.elapsed - before;
    if (run.elapsed >= run.span && (run.rate > 0 || moved > 0)) {
      run.ramp = null;
      run.elapsed = run.span;
      run.rate = 0;
      hub.subs.emit();
    } else if (run.elapsed <= 0 && (run.rate < 0 || moved < 0)) {
      run.ramp = null;
      run.elapsed = 0;
      run.rate = 0;
      hub.subs.emit();
    }
  }
  run.last = timestamp;
  run.changed = false;
  run.wakeFired = false;
  run.slept = isInert(run);
  if (run.elapsed !== before) run.edge = false;
  if (run.elapsed !== before || wasChanged) {
    hub.frames.emit(run.elapsed, passAt(run));
  }
}

function createClockView(run: Run, hub: Hub, seekable: boolean, speeds: readonly number[]): Clock {
  const clock: Clock = {
    get elapsed() {
      return run.elapsed;
    },
    get pass() {
      return passAt(run);
    },
    get phase() {
      return phaseAt(run);
    },
    get duration() {
      return run.duration;
    },
    set duration(next: number) {
      setDuration(run, hub, next);
    },
    get origin() {
      return run.origin;
    },
    get speed() {
      return run.speed;
    },
    speeds,
    seekable,
    get ended() {
      return Number.isFinite(run.span) && run.elapsed >= run.span;
    },
    get rate() {
      return run.rate;
    },
    set rate(next: number) {
      checkRate(next, seekable);
      if (Object.is(next, run.rate) && run.ramp === null) return;
      run.rate = next;
      run.ramp = null;
      change(run, hub);
      hub.subs.emit();
    },
    get loop() {
      return run.loop;
    },
    set loop(next: boolean | number) {
      checkLoop(next);
      if (next === run.loop) return;
      const { pass, into } = passOf(run);
      run.loop = next;
      run.span = run.duration * passesOf(run.loop);
      if (Number.isFinite(run.duration)) placeIn(run, pass, into);
      change(run, hub);
      hub.subs.emit();
    },
    get ramping() {
      return run.ramp !== null;
    },
    ramp(to, over) {
      checkRate(to, seekable);
      checkRampTime(over);
      if (!(over > 0)) {
        clock.rate = to;
        return;
      }
      run.ramp = { to, left: over, over };
      run.t.ramp(to, over);
      change(run, hub);
      hub.subs.emit();
    },
    seek(target, line = 'start') {
      if (!seekable) throw new Error('this clock is not seekable');
      const to = clamp(run, target);
      if (!Number.isFinite(to)) throw new RangeError(`a clock seeks to a time in its run, not ${target}`);
      const was = { elapsed: run.elapsed, pass: passAt(run), phase: phaseAt(run) };
      run.elapsed = to;
      run.edge = line === 'end';
      if (Object.is(to, was.elapsed) && passAt(run) === was.pass && phaseAt(run) === was.phase) return;
      change(run, hub);
      hub.subs.emit();
    },
    sync: (timestamp) => syncTo(run, hub, timestamp),
    rebase() {
      run.last = Number.NaN;
      run.t.rebase();
    },
    get inert() {
      return isInert(run);
    },
    onWake: hub.wakes.subscribe,
    subscribe: hub.subs.subscribe,
  };
  return clock;
}

/** A clock, opened from its declaration and, for a run reopened, where it
 *  stood. */
export function createClock(spec: ClockSpec, at?: ClockPosition): ClockHandle {
  const duration = at?.duration ?? spec.duration ?? Number.POSITIVE_INFINITY;
  checkDuration(duration);
  const seekable = spec.seekable ?? true;
  const openRate = spec.rate ?? 0;
  checkRate(openRate, seekable);
  if (at) checkRate(at.rate, seekable);
  const speeds = speedsOf(spec);

  const origin = at?.origin ?? spec.origin ?? 0;
  checkOrigin(origin);
  if (spec.speed !== undefined) checkSpeed(spec.speed);
  const loop = spec.loop ?? false;
  checkLoop(loop);
  // Seeking needs history with a tape, and a seek reaches back no further than history keeps.
  const t = createTransport({ history: { ms: Number.POSITIVE_INFINITY, tape: createHistory } });
  // Only a mix moves a transport's time, so with none of the host's the clock keeps an empty one on it.
  const mix = spec.mix?.(t) ?? null;
  if (!mix) createMix(kit({}), { transport: t });
  // Seeking needs a first sync, and nothing seeks to before it: the run's 0 is that sync's time.
  t.sync(0);
  t.rebase();
  if (mix && !Object.is(mix.now, t.now)) throw new Error("ClockSpec.mix makes its mix on the transport it is given");
  const run: Run = {
    duration,
    loop,
    span: duration * passesOf(loop),
    origin,
    speed: declaredSpeed(spec),
    get rate() {
      return t.rate;
    },
    set rate(next: number) {
      t.ramp(next, 0);
    },
    get elapsed() {
      return t.now;
    },
    set elapsed(to: number) {
      seekTransport(run, to);
    },
    edge: at?.passEnd ?? false,
    ramp: null,
    last: Number.NaN,
    changed: false,
    slept: false,
    wakeFired: false,
    t,
  };
  run.rate = 1;
  // The end of the declared run, where a run made endless since (a loop toggle, a duration write, an override)
  // opens at `'end'`; `declare` refuses a declaration that has none.
  let declaredEnd = (spec.duration ?? Number.POSITIVE_INFINITY) * passesOf(loop);
  const opening = (): number => {
    if (spec.start !== 'end') return clamp(run, spec.start ?? 0);
    const end = Number.isFinite(run.span) ? run.span : declaredEnd;
    if (!Number.isFinite(end)) throw new RangeError("a run that never ends has no 'end' to start at");
    return end;
  };
  const openAt = at ? clamp(run, at.elapsed) : opening();
  if (!Number.isFinite(openAt))
    throw new RangeError(`a clock opens at a time in its run, not ${at ? at.elapsed : spec.start}`);
  run.elapsed = openAt;
  run.rate = at ? at.rate : openRate;

  const hub: Hub = {
    wakes: createEmitter(),
    subs: createEmitter(),
    frames: createEmitter<[elapsed: number, pass: number]>(),
    opening,
  };
  const clock = createClockView(run, hub, seekable, speeds);

  let declared: Declared = {
    duration: spec.duration ?? Number.POSITIVE_INFINITY,
    origin: spec.origin ?? 0,
    loop: run.loop,
    speed: run.speed,
  };
  let override: SpanOverride = null;

  return {
    clock,
    mix,
    step: spec.step,
    reset() {
      run.elapsed = hub.opening();
      // An end on a pass line of a run made endless is that pass's end, not the next one's start.
      run.edge = spec.start === 'end' && run.elapsed > 0;
      run.rate = openRate;
      run.ramp = null;
      change(run, hub);
      hub.subs.emit();
    },
    // `applyRun` checks before it writes, so a declaration or override it refuses is not kept either.
    declare(next) {
      const taken = declaredOf(next);
      // Checked under an override too, which would otherwise hand a bad duration to the call that lifts it.
      checkDuration(taken.duration);
      checkOrigin(taken.origin);
      const end = taken.duration * passesOf(taken.loop);
      if (spec.start === 'end' && !Number.isFinite(end))
        throw new RangeError("a clock that opens at its 'end' is declared a run that ends");
      // A declaration that keeps its loop leaves one set since, as a transport's toggle.
      applyRun(run, hub, { ...taken, loop: taken.loop !== declared.loop ? taken.loop : run.loop }, override);
      declared = taken;
      declaredEnd = end;
    },
    override(next) {
      const taken = next ? { ...next } : null;
      applyRun(run, hub, { ...declared, loop: run.loop }, taken);
      override = taken;
    },
    onFrame: hub.frames.subscribe,
  };
}
