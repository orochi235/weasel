import { createEmitter } from '@weasel-js/registry';
import { followMix } from './mixFollow';
import { passesOf, placeOf } from './place';
import { type Ramp, stepRamp } from './ramp';
import type { Clock, ClockHandle, ClockPosition, ClockSpec } from './types';
import { checkDuration, checkOrigin, checkRate, checkSpeed, ratesOf } from './validate';

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
  rate: number;
  elapsed: number;
  edge: boolean;
  ramp: Ramp | null;
  last: number;
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
  follow: (elapsed: number) => void;
  /** Where a new run opens. */
  opening: () => number;
}

const clamp = (run: Run, ms: number): number => Math.min(Math.max(0, ms), run.span);
const isInert = (run: Run): boolean => run.rate === 0 && run.ramp === null && !run.changed;
const passAt = (run: Run): number =>
  placeOf(run.elapsed, run.duration, passesOf(run.loop), run.edge).pass;
const phaseAt = (run: Run): number =>
  placeOf(run.elapsed, run.duration, passesOf(run.loop), run.edge).phase;

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
    const at = passAt(run) + phaseAt(run);
    run.duration = next;
    run.span = run.duration * passesOf(run.loop);
    run.elapsed = ended ? run.span : clamp(run, at * run.duration);
  } else {
    run.duration = next;
    run.span = run.duration * passesOf(run.loop);
    run.elapsed = clamp(run, run.elapsed);
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

function declaredOf(run: Run, spec: ClockSpec): Declared {
  return {
    duration: spec.duration ?? Number.POSITIVE_INFINITY,
    origin: spec.origin ?? 0,
    loop: spec.loop ?? false,
    speed: spec.speed ?? (Math.abs(run.rate) || 1),
  };
}

/** Takes up `declared` with `override` laid over it, keeping the shown time, clamped. */
function applyRun(run: Run, hub: Hub, declared: Declared, override: SpanOverride): void {
  const duration = override?.duration ?? declared.duration;
  const origin = override?.origin ?? declared.origin;
  checkDuration(duration);
  checkOrigin(origin);
  checkSpeed(declared.speed);
  const shown = run.origin + run.elapsed;
  run.duration = duration;
  run.loop = declared.loop;
  run.span = duration * passesOf(run.loop);
  run.origin = origin;
  run.speed = declared.speed;
  run.elapsed = clamp(run, shown - origin);
  run.edge = false;
  change(run, hub);
  hub.subs.emit();
}

/** ms of clock time over `dt` real ms, ramp included; settles the ramp. */
function advance(run: Run, hub: Hub, dt: number): number {
  const step = stepRamp(run.rate, run.ramp, dt);
  run.rate = step.rate;
  run.ramp = step.ramp;
  if (step.settled) hub.subs.emit();
  return step.area;
}

function syncTo(run: Run, hub: Hub, timestamp: number): void {
  const wasChanged = run.changed;
  const before = run.elapsed;
  if (!Number.isNaN(run.last) && !run.slept) {
    run.elapsed += advance(run, hub, Math.max(0, timestamp - run.last));
    if (run.elapsed >= run.span && run.rate > 0) {
      run.elapsed = run.span;
      run.rate = 0;
      run.ramp = null;
      hub.subs.emit();
    } else if (run.elapsed <= 0 && run.rate < 0) {
      run.elapsed = 0;
      run.rate = 0;
      run.ramp = null;
      hub.subs.emit();
    }
  }
  run.last = timestamp;
  run.changed = false;
  run.wakeFired = false;
  run.slept = isInert(run);
  if (run.elapsed !== before) run.edge = false;
  if (run.elapsed !== before || wasChanged) {
    hub.follow(run.elapsed);
    hub.frames.emit(run.elapsed, passAt(run));
  }
}

function clockOf(run: Run, hub: Hub, seekable: boolean, rates: readonly number[]): Clock {
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
    rates,
    seekable,
    get ended() {
      return Number.isFinite(run.span) && run.elapsed >= run.span;
    },
    get rate() {
      return run.rate;
    },
    set rate(next: number) {
      checkRate(next, seekable);
      run.rate = next;
      run.ramp = null;
      change(run, hub);
      hub.subs.emit();
    },
    get loop() {
      return run.loop;
    },
    set loop(next: boolean | number) {
      run.loop = next;
      run.span = run.duration * passesOf(run.loop);
      run.elapsed = Math.min(run.elapsed, run.span);
      change(run, hub);
      hub.subs.emit();
    },
    ramp(to, over) {
      checkRate(to, seekable);
      if (!(over > 0)) {
        clock.rate = to;
        return;
      }
      run.ramp = { to, left: over };
      change(run, hub);
      hub.subs.emit();
    },
    seek(target, line = 'start') {
      if (!seekable) throw new Error('this clock is not seekable');
      run.elapsed = clamp(run, target);
      run.edge = line === 'end';
      change(run, hub);
      hub.subs.emit();
    },
    sync: (timestamp) => syncTo(run, hub, timestamp),
    rebase() {
      run.last = Number.NaN;
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
  const rates = ratesOf(spec);

  checkOrigin(spec.origin ?? 0);
  if (spec.speed !== undefined) checkSpeed(spec.speed);
  const loop = spec.loop ?? false;
  const run: Run = {
    duration,
    loop,
    span: duration * passesOf(loop),
    origin: spec.origin ?? 0,
    speed: spec.speed ?? (Math.abs(openRate) || 1),
    rate: at ? at.rate : openRate,
    elapsed: 0,
    edge: at?.passEnd ?? false,
    ramp: null,
    last: Number.NaN,
    changed: false,
    slept: false,
    wakeFired: false,
  };
  const opening = (): number => {
    if (spec.start !== 'end') return clamp(run, spec.start ?? 0);
    if (!Number.isFinite(run.span))
      throw new RangeError("a run that never ends has no 'end' to start at");
    return run.span;
  };
  run.elapsed = at ? clamp(run, at.elapsed) : opening();

  const mix = spec.mix?.() ?? null;
  const hub: Hub = {
    wakes: createEmitter(),
    subs: createEmitter(),
    frames: createEmitter<[elapsed: number, pass: number]>(),
    follow: followMix(mix),
    opening,
  };
  const clock = clockOf(run, hub, seekable, rates);
  hub.follow(run.elapsed);

  let declared: Declared = {
    duration: spec.duration ?? Number.POSITIVE_INFINITY,
    origin: run.origin,
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
      run.edge = false;
      run.rate = openRate;
      run.ramp = null;
      change(run, hub);
      hub.subs.emit();
    },
    declare(next) {
      declared = declaredOf(run, next);
      applyRun(run, hub, declared, override);
    },
    override(next) {
      override = next ? { ...next } : null;
      applyRun(run, hub, declared, override);
    },
    onFrame: hub.frames.subscribe,
  };
}
