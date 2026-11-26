import type { Transport } from '@msb235/blits';
import type { createEmitter } from '@weasel-js/registry';
import { passesOf, placeOf } from './place';
import type { ClockSpec } from './types';
import { checkDuration, checkLoop, checkOrigin, checkSpeed } from './validate';

/** A clock's moving parts, read and written by the functions below. */
export interface Run {
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
  last: number;
  t: Transport;
  /** Changed since the last sync, so the next one is due even when paused. */
  changed: boolean;
  /** Inert as of the last sync: the next one only records the time. */
  slept: boolean;
  wakeFired: boolean;
}

export interface Hub {
  wakes: ReturnType<typeof createEmitter>;
  subs: ReturnType<typeof createEmitter>;
  frames: ReturnType<typeof createEmitter<[elapsed: number, pass: number]>>;
  /** Where a new run opens. */
  opening: () => number;
}

export const clamp = (run: Run, ms: number): number => Math.min(Math.max(0, ms), run.span);
export const isInert = (run: Run): boolean => run.rate === 0 && run.t.ramping === null && !run.changed;
export const passAt = (run: Run): number =>
  placeOf(run.elapsed, run.duration, passesOf(run.loop), run.edge).pass;
export const phaseAt = (run: Run): number =>
  placeOf(run.elapsed, run.duration, passesOf(run.loop), run.edge).phase;
/** The speed a transport plays a paused clock at, when none is declared. */
/** The speed `spec` declares: its `speed`, else its `rate` unsigned, else 1. */
export const declaredSpeed = (spec: ClockSpec): number => spec.speed ?? (Math.abs(spec.rate ?? 0) || 1);

/** Which pass `elapsed` falls in and how far into it, in ms; a pass's end stands as its own. */
export function passOf(run: Run): { pass: number; into: number } {
  const { pass } = placeOf(run.elapsed, run.duration, passesOf(run.loop), run.edge);
  return { pass, into: pass === 0 ? run.elapsed : run.elapsed - pass * run.duration };
}

/** Places `into` ms into pass `pass` of the run, the pass clamped to the run's last and
 *  `into` to the pass; `into` at the pass's end stands as that end, not the next pass's start. */
export function placeIn(run: Run, pass: number, into: number): void {
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

export function change(run: Run, hub: Hub): void {
  run.changed = true;
  if (run.wakeFired) return;
  run.wakeFired = true;
  hub.wakes.emit();
}

export function setDuration(run: Run, hub: Hub, next: number): void {
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
export interface Declared {
  duration: number;
  origin: number;
  loop: boolean | number;
  speed: number;
}

/** A runtime replacement for the declared `duration` and `origin`; see `ClockHandle.override`. */
export type SpanOverride = { duration?: number; origin?: number } | null;

export function declaredOf(spec: ClockSpec): Declared {
  return {
    duration: spec.duration ?? Number.POSITIVE_INFINITY,
    origin: spec.origin ?? 0,
    loop: spec.loop ?? false,
    speed: declaredSpeed(spec),
  };
}

/** Takes up `declared` with `override` laid over it, keeping the pass and the
 *  shown time within it, clamped. */
export function applyRun(run: Run, hub: Hub, declared: Declared, override: SpanOverride): void {
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
